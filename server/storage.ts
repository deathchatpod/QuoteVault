import { quotes, searchQueries, quoteQueries, type Quote, type InsertQuote, type SearchQuery, type InsertSearchQuery, type InsertQuoteQuery } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { calculateConfidenceScore } from "./services/confidence-scoring";

export interface IStorage {
  // Quotes
  getQuote(id: string): Promise<Quote | undefined>;
  getAllQuotes(): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<void>;
  findDuplicateQuote(quoteText: string): Promise<Quote | undefined>;
  mergeQuotes(existingQuote: Quote, newData: Partial<InsertQuote>): Promise<Quote>;

  // Search Queries
  getSearchQuery(id: string): Promise<SearchQuery | undefined>;
  getAllSearchQueries(): Promise<SearchQuery[]>;
  createSearchQuery(query: InsertSearchQuery): Promise<SearchQuery>;
  updateSearchQuery(id: string, query: Partial<InsertSearchQuery>): Promise<SearchQuery | undefined>;
  completeSearchQuery(id: string, quotesFound: number, quotesVerified: number, apiCost: number, processingTimeMs: number): Promise<void>;

  // Quote-Query Links
  linkQuoteToQuery(quoteId: string, queryId: string): Promise<void>;
  getQuotesByQueryId(queryId: string): Promise<Quote[]>;
}

export class DatabaseStorage implements IStorage {
  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote || undefined;
  }

  async getAllQuotes(): Promise<Quote[]> {
    return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const confidenceScore = calculateConfidenceScore(
      insertQuote.verified ?? false,
      (insertQuote.sourceConfidence as "high" | "medium" | "low") ?? "medium",
      (insertQuote.sources as string[]) ?? [],
      !!insertQuote.reference
    );
    
    const quoteWithScore = {
      ...insertQuote,
      confidenceScore,
    };
    
    const [quote] = await db.insert(quotes).values(quoteWithScore).returning();
    return quote;
  }

  async updateQuote(id: string, updateData: Partial<InsertQuote>): Promise<Quote | undefined> {
    const existing = await this.getQuote(id);
    if (!existing) return undefined;
    
    const confidenceScore = calculateConfidenceScore(
      updateData.verified ?? existing.verified,
      (updateData.sourceConfidence as "high" | "medium" | "low") ?? existing.sourceConfidence as any,
      (updateData.sources as string[]) ?? (existing.sources as string[] ?? []),
      !!(updateData.reference ?? existing.reference)
    );
    
    const [quote] = await db
      .update(quotes)
      .set({ ...updateData, confidenceScore })
      .where(eq(quotes.id, id))
      .returning();
    return quote || undefined;
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async findDuplicateQuote(quoteText: string): Promise<Quote | undefined> {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(sql`LOWER(${quotes.quote}) = LOWER(${quoteText})`);
    return quote || undefined;
  }

  async mergeQuotes(existingQuote: Quote, newData: Partial<InsertQuote>): Promise<Quote> {
    const mergedSources = Array.from(new Set([
      ...(Array.isArray(existingQuote.sources) ? (existingQuote.sources as string[]) : []),
      ...(Array.isArray(newData.sources) ? (newData.sources as string[]) : []),
    ]));
    
    const mergedConfidence = (newData.sourceConfidence === "high" || existingQuote.sourceConfidence === "high")
      ? "high"
      : (newData.sourceConfidence === "medium" || existingQuote.sourceConfidence === "medium")
      ? "medium"
      : existingQuote.sourceConfidence;
    
    const mergedVerified = newData.verified ?? existingQuote.verified;
    const mergedReference = newData.reference || existingQuote.reference;
    
    const mergedData: Partial<InsertQuote> = {
      speaker: newData.speaker || existingQuote.speaker,
      author: newData.author || existingQuote.author,
      work: newData.work || existingQuote.work,
      year: newData.year || existingQuote.year,
      type: newData.type || existingQuote.type,
      reference: mergedReference,
      verified: mergedVerified,
      sourceConfidence: mergedConfidence,
      sources: mergedSources,
      confidenceScore: calculateConfidenceScore(
        mergedVerified,
        mergedConfidence as "high" | "medium" | "low",
        mergedSources,
        !!mergedReference
      ),
    };

    const [updated] = await db
      .update(quotes)
      .set(mergedData)
      .where(eq(quotes.id, existingQuote.id))
      .returning();
    return updated;
  }

  async getSearchQuery(id: string): Promise<SearchQuery | undefined> {
    const [query] = await db.select().from(searchQueries).where(eq(searchQueries.id, id));
    return query || undefined;
  }

  async getAllSearchQueries(): Promise<SearchQuery[]> {
    return await db.select().from(searchQueries).orderBy(desc(searchQueries.createdAt));
  }

  async createSearchQuery(insertQuery: InsertSearchQuery): Promise<SearchQuery> {
    const [query] = await db.insert(searchQueries).values(insertQuery).returning();
    return query;
  }

  async updateSearchQuery(id: string, updateData: Partial<InsertSearchQuery>): Promise<SearchQuery | undefined> {
    const [query] = await db
      .update(searchQueries)
      .set(updateData)
      .where(eq(searchQueries.id, id))
      .returning();
    return query || undefined;
  }

  async completeSearchQuery(
    id: string,
    quotesFound: number,
    quotesVerified: number,
    apiCost: number,
    processingTimeMs: number
  ): Promise<void> {
    await db
      .update(searchQueries)
      .set({
        status: "completed",
        quotesFound,
        quotesVerified,
        apiCost,
        processingTimeMs,
        completedAt: new Date(),
      })
      .where(eq(searchQueries.id, id));
  }

  async linkQuoteToQuery(quoteId: string, queryId: string): Promise<void> {
    await db.insert(quoteQueries).values({ quoteId, queryId });
  }

  async getQuotesByQueryId(queryId: string): Promise<Quote[]> {
    const results = await db
      .select({ quote: quotes })
      .from(quoteQueries)
      .innerJoin(quotes, eq(quoteQueries.quoteId, quotes.id))
      .where(eq(quoteQueries.queryId, queryId))
      .orderBy(desc(quoteQueries.createdAt));
    
    return results.map(r => r.quote);
  }
}

export const storage = new DatabaseStorage();
