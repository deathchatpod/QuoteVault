import { quotes, searchQueries, type Quote, type InsertQuote, type SearchQuery, type InsertSearchQuery } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

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
    const [quote] = await db.insert(quotes).values(insertQuote).returning();
    return quote;
  }

  async updateQuote(id: string, updateData: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [quote] = await db
      .update(quotes)
      .set(updateData)
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
    const mergedData: Partial<InsertQuote> = {
      speaker: newData.speaker || existingQuote.speaker,
      author: newData.author || existingQuote.author,
      work: newData.work || existingQuote.work,
      year: newData.year || existingQuote.year,
      type: newData.type || existingQuote.type,
      reference: newData.reference || existingQuote.reference,
      verified: newData.verified ?? existingQuote.verified,
      sourceConfidence: (newData.sourceConfidence === "high" || existingQuote.sourceConfidence === "high")
        ? "high"
        : (newData.sourceConfidence === "medium" || existingQuote.sourceConfidence === "medium")
        ? "medium"
        : existingQuote.sourceConfidence,
      sources: [
        ...new Set([
          ...(Array.isArray(existingQuote.sources) ? (existingQuote.sources as string[]) : []),
          ...(Array.isArray(newData.sources) ? (newData.sources as string[]) : []),
        ]),
      ],
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
}

export const storage = new DatabaseStorage();
