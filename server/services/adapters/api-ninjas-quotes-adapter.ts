import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface APINinjasQuoteResponse {
  quote: string;
  author: string;
  work: string;
  categories: string[];
}

/**
 * Adapter for API Ninjas Quotes v2
 * Provides tens of thousands of celebrity and inspirational quotes
 * Requires API key (paid service)
 */
export class APINinjasQuotesAdapter implements IQuoteSourceAdapter {
  name = "api-ninjas-quotes";
  domain = "celebrity";
  requiresAuth = true;
  costPerCall = 0.001; // Estimate based on API pricing
  rateLimit = 100;

  private baseUrl = "https://api.api-ninjas.com/v2/quotes";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.API_NINJAS_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[APINinjasQuotesAdapter] No API key provided - adapter will not function");
    }
  }

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    if (!this.apiKey) {
      console.error("[APINinjasQuotesAdapter] API key not configured");
      return [];
    }

    const quotes: InsertQuote[] = [];
    
    try {
      const params = new URLSearchParams();
      params.append('limit', Math.min(maxResults, 100).toString());
      
      if (searchType === "author") {
        params.append('author', query);
      } else if (searchType === "work") {
        params.append('work', query);
      } else if (searchType === "topic") {
        // Use categories for topic search
        params.append('categories', query.toLowerCase());
      }
      
      const results = await this.fetchQuotes(params);
      quotes.push(...results);
    } catch (error: any) {
      console.error(`[APINinjasQuotesAdapter] Search error:`, error.message);
    }
    
    return quotes.slice(0, maxResults);
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const params = new URLSearchParams();
      params.append('limit', Math.min(count, 100).toString());
      
      return await this.fetchQuotes(params);
    } catch (error) {
      console.error(`[APINinjasQuotesAdapter] Random fetch error:`, error);
      return [];
    }
  }

  private async fetchQuotes(params: URLSearchParams): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}?${params.toString()}`, {
            headers: {
              'X-Api-Key': this.apiKey,
            },
          });
          if (!res.ok) {
            throw new Error(`API Ninjas returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      if (!Array.isArray(response)) {
        return [];
      }

      return response.map((item: APINinjasQuoteResponse) => 
        createNormalizedQuote({
          text: item.quote,
          speaker: item.author,
          author: item.author,
          work: item.work || null,
          type: "celebrity",
          reference: item.categories?.join(", "),
          source: "api-ninjas-quotes",
          verified: false,
          sourceConfidence: "high", // Professional API with curated content
        })
      );
    } catch (error) {
      console.error(`[APINinjasQuotesAdapter] Fetch error:`, error);
      return [];
    }
  }
}
