import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface ZenQuote {
  q: string; // quote text
  a: string; // author
  h: string; // HTML formatted
}

/**
 * Adapter for ZenQuotes API
 * Provides inspirational quotes with rate limiting
 * Free tier: 5 requests per 30 seconds
 */
export class ZenQuotesAdapter implements IQuoteSourceAdapter {
  name = "zenquotes";
  domain = "inspiration";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 10; // 5 per 30 seconds = 10 per minute

  private baseUrl = "https://zenquotes.io/api";
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly rateLimitWindow = 30000; // 30 seconds in ms
  private readonly maxRequestsPerWindow = 5;

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Get random quotes and filter (API doesn't support search)
      const quotes = await this.getQuotes(Math.min(maxResults * 2, 50));
      
      const filtered = quotes.filter(q => {
        const lowerQuery = query.toLowerCase();
        
        if (searchType === "author") {
          return q.author?.toLowerCase().includes(lowerQuery);
        } else if (searchType === "topic") {
          return q.quote.toLowerCase().includes(lowerQuery);
        }
        
        return false;
      });

      return filtered.slice(0, maxResults);
    } catch (error: any) {
      console.error(`[ZenQuotesAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      return await this.getQuotes(Math.min(count, 50));
    } catch (error: any) {
      console.error(`[ZenQuotesAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async getQuotes(count: number): Promise<InsertQuote[]> {
    await this.enforceRateLimit();

    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/quotes`);
          if (!res.ok) {
            throw new Error(`ZenQuotes API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as ZenQuote[];
      
      return data
        .slice(0, count)
        .map(q => createNormalizedQuote({
          text: q.q,
          speaker: null,
          author: q.a !== "zenquotes.io" ? q.a : null,
          work: null,
          type: "inspiration",
          source: "zenquotes",
          verified: false,
          sourceConfidence: "high",
        }));
    } catch (error) {
      console.error(`[ZenQuotesAdapter] Fetch error:`, error);
      return [];
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset counter if window has passed
    if (timeSinceLastRequest >= this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Wait if we've hit the limit
    if (this.requestCount >= this.maxRequestsPerWindow) {
      const waitTime = this.rateLimitWindow - timeSinceLastRequest;
      console.log(`[ZenQuotesAdapter] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }

    this.requestCount++;
  }
}
