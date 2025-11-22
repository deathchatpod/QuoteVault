import type { InsertQuote } from "@shared/schema";

/**
 * Interface for quote source adapters
 * Each source (API or scraper) implements this interface to normalize quotes
 */
export interface IQuoteSourceAdapter {
  /**
   * Unique identifier for this source
   */
  name: string;
  
  /**
   * Domain category (e.g., "tv", "movie", "music", "political", "religious")
   */
  domain: string;
  
  /**
   * Whether this source requires payment/API key
   */
  requiresAuth: boolean;
  
  /**
   * Cost per API call (0 for free sources)
   */
  costPerCall: number;
  
  /**
   * Rate limit (requests per minute, 0 for unlimited)
   */
  rateLimit: number;
  
  /**
   * Search for quotes matching the query
   * @param query - Search term
   * @param searchType - Type of search (topic, author, work)
   * @param maxResults - Maximum number of results to return
   * @returns Array of normalized quotes
   */
  search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]>;
  
  /**
   * Get random quotes from this source
   * @param count - Number of random quotes to fetch
   * @returns Array of normalized quotes
   */
  getRandom?(count: number): Promise<InsertQuote[]>;
}

/**
 * Registry of all quote source adapters
 */
class QuoteSourceRegistry {
  private adapters: Map<string, IQuoteSourceAdapter> = new Map();
  
  register(adapter: IQuoteSourceAdapter) {
    this.adapters.set(adapter.name, adapter);
  }
  
  get(name: string): IQuoteSourceAdapter | undefined {
    return this.adapters.get(name);
  }
  
  getAll(): IQuoteSourceAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  getByDomain(domain: string): IQuoteSourceAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.domain === domain);
  }
  
  getFree(): IQuoteSourceAdapter[] {
    return Array.from(this.adapters.values()).filter(a => !a.requiresAuth);
  }
  
  getPaid(): IQuoteSourceAdapter[] {
    return Array.from(this.adapters.values()).filter(a => a.requiresAuth);
  }
}

export const quoteSourceRegistry = new QuoteSourceRegistry();

/**
 * Helper to normalize quote data from different sources
 */
export function createNormalizedQuote(params: {
  text: string;
  speaker?: string | null;
  author?: string | null;
  work?: string | null;
  year?: string | null;
  type?: string | null;
  reference?: string | null;
  source: string;
  verified?: boolean;
  sourceConfidence?: "high" | "medium" | "low";
}): InsertQuote {
  return {
    quote: params.text,
    speaker: params.speaker || null,
    author: params.author || null,
    work: params.work || null,
    year: params.year || null,
    type: params.type || null,
    reference: params.reference || null,
    verified: params.verified || false,
    sources: [params.source],
    sourceConfidence: params.sourceConfidence || "medium",
    confidenceScore: 0.5,
  };
}
