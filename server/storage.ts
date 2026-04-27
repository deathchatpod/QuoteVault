import { quotes, searchQueries, quoteQueries, type Quote, type InsertQuote, type SearchQuery, type InsertSearchQuery, type InsertQuoteQuery } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte, ilike, asc } from "drizzle-orm";
import { calculateConfidenceScore } from "./services/confidence-scoring";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuoteFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  verified?: boolean;
  type?: string;
  verificationStatus?: string;
  minConfidence?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IStorage {
  // Quotes
  getQuote(id: string): Promise<Quote | undefined>;
  getAllQuotes(): Promise<Quote[]>;
  getQuotesPaginated(filters: QuoteFilters): Promise<PaginatedResult<Quote>>;
  searchQuotesFTS(query: string, filters?: QuoteFilters): Promise<PaginatedResult<Quote>>;
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

  async getQuotesPaginated(filters: QuoteFilters): Promise<PaginatedResult<Quote>> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 50));
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [];

    if (filters.verified !== undefined) {
      conditions.push(eq(quotes.verified, filters.verified));
    }
    if (filters.type) {
      conditions.push(eq(quotes.type, filters.type));
    }
    if (filters.verificationStatus) {
      conditions.push(eq(quotes.verificationStatus, filters.verificationStatus));
    }
    if (filters.minConfidence !== undefined) {
      conditions.push(gte(quotes.confidenceScore, filters.minConfidence));
    }
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        sql`(${quotes.quote} ILIKE ${searchTerm} OR ${quotes.author} ILIKE ${searchTerm} OR ${quotes.speaker} ILIKE ${searchTerm} OR ${quotes.work} ILIKE ${searchTerm})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get sort column
    let orderColumn: any = desc(quotes.createdAt);
    const sortOrder = filters.sortOrder || "desc";
    if (filters.sortBy) {
      const col = (quotes as any)[filters.sortBy];
      if (col) {
        orderColumn = sortOrder === "asc" ? asc(col) : desc(col);
      }
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(whereClause);

    const data = await db
      .select()
      .from(quotes)
      .where(whereClause)
      .orderBy(orderColumn)
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total: countResult?.count || 0,
      page,
      pageSize,
    };
  }

  async searchQuotesFTS(query: string, filters: QuoteFilters = {}): Promise<PaginatedResult<Quote>> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize || 50));
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [
      sql`search_vector @@ plainto_tsquery('english', ${query})`
    ];

    if (filters.verified !== undefined) {
      conditions.push(eq(quotes.verified, filters.verified));
    }
    if (filters.verificationStatus) {
      conditions.push(eq(quotes.verificationStatus, filters.verificationStatus));
    }
    if (filters.type) {
      conditions.push(eq(quotes.type, filters.type));
    }
    if (filters.minConfidence !== undefined) {
      conditions.push(gte(quotes.confidenceScore, filters.minConfidence));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(whereClause);

    const data = await db
      .select()
      .from(quotes)
      .where(whereClause)
      .orderBy(sql`ts_rank(search_vector, plainto_tsquery('english', ${query})) DESC`)
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total: countResult?.count || 0,
      page,
      pageSize,
    };
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const confidenceScore = calculateConfidenceScore(insertQuote);

    const quoteWithScore = {
      ...insertQuote,
      confidenceScore,
    };

    const [quote] = await db.insert(quotes).values(quoteWithScore as any).returning();
    return quote;
  }

  async updateQuote(id: string, updateData: Partial<InsertQuote>): Promise<Quote | undefined> {
    const existing = await this.getQuote(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...updateData };
    const confidenceScore = calculateConfidenceScore(merged as any);

    const [quote] = await db
      .update(quotes)
      .set({ ...updateData, confidenceScore, updatedAt: new Date() } as any)
      .where(eq(quotes.id, id))
      .returning();
    return quote || undefined;
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async findDuplicateQuote(quoteText: string): Promise<Quote | undefined> {
    // Use trigram similarity for fuzzy matching (threshold 0.7)
    // Falls back to exact LOWER match if pg_trgm not available
    try {
      const [quote] = await db
        .select()
        .from(quotes)
        .where(sql`similarity(${quotes.quote}, ${quoteText}) >= 0.7`)
        .orderBy(sql`similarity(${quotes.quote}, ${quoteText}) DESC`)
        .limit(1);
      return quote || undefined;
    } catch {
      // Fallback to exact match if similarity() not available
      const [quote] = await db
        .select()
        .from(quotes)
        .where(sql`LOWER(${quotes.quote}) = LOWER(${quoteText})`);
      return quote || undefined;
    }
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
    };

    // If merged from 2+ distinct sources, mark cross_verified
    if (mergedSources.length >= 2) {
      mergedData.verificationStatus = "cross_verified";
      (mergedData as any).crossVerifiedAt = new Date();
      (mergedData as any).verificationSources = mergedSources.map(s => ({ source: s, matchedAt: new Date().toISOString() }));
    }

    const confidenceScore = calculateConfidenceScore(mergedData as any);
    (mergedData as any).confidenceScore = confidenceScore;

    const [updated] = await db
      .update(quotes)
      .set({ ...mergedData, updatedAt: new Date() } as any)
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
