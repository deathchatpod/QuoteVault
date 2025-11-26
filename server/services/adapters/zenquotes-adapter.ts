import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface ZenQuote {
  q: string; // quote text
  a: string; // author
  h: string; // HTML formatted
  c?: string; // character count (premium)
  i?: string; // image URL (premium)
}

/**
 * Adapter for ZenQuotes API
 * Supports both free tier (rate limited) and premium tier (unlimited)
 * Free tier: 5 requests per 30 seconds
 * Premium tier: Unlimited requests, author filtering, keyword search
 */
export class ZenQuotesAdapter implements IQuoteSourceAdapter {
  name = "zenquotes";
  domain = "inspiration";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 60; // Premium allows unlimited, but we'll be reasonable

  private baseUrl = "https://zenquotes.io/api";
  private apiKey: string | null = null;
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly rateLimitWindow = 30000; // 30 seconds in ms
  private readonly maxRequestsPerWindow = 5; // Free tier limit

  constructor() {
    this.apiKey = process.env.ZENQUOTES_API_KEY || null;
    if (this.apiKey) {
      console.log("[ZenQuotesAdapter] Premium API key configured - unlimited requests enabled");
      this.requiresAuth = true;
    }
  }

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Premium tier supports author search directly
      if (this.apiKey && searchType === "author") {
        return await this.searchByAuthor(query, maxResults);
      }
      
      // Premium tier supports keyword search
      if (this.apiKey && searchType === "topic") {
        return await this.searchByKeyword(query, maxResults);
      }

      // Free tier: Get random quotes and filter locally
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

  private async searchByAuthor(author: string, maxResults: number): Promise<InsertQuote[]> {
    if (!this.apiKey) return [];
    
    try {
      // ZenQuotes expects hash appended to URL path, not as query parameter
      const url = `${this.baseUrl}/quotes/author/${encodeURIComponent(author)}/${this.apiKey}`;
      
      const response = await pRetry(
        async () => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`ZenQuotes API returned ${res.status}`);
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = response as ZenQuote[];
      return data.slice(0, maxResults).map(q => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[ZenQuotesAdapter] Author search error:`, error.message);
      return [];
    }
  }

  private async searchByKeyword(keyword: string, maxResults: number): Promise<InsertQuote[]> {
    if (!this.apiKey) return [];
    
    try {
      // ZenQuotes expects hash appended to URL path, not as query parameter
      const url = `${this.baseUrl}/quotes/keyword/${encodeURIComponent(keyword)}/${this.apiKey}`;
      
      const response = await pRetry(
        async () => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`ZenQuotes API returned ${res.status}`);
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = response as ZenQuote[];
      return data.slice(0, maxResults).map(q => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[ZenQuotesAdapter] Keyword search error:`, error.message);
      return [];
    }
  }

  private normalizeQuote(q: ZenQuote): InsertQuote {
    return createNormalizedQuote({
      text: q.q,
      speaker: null,
      author: q.a !== "zenquotes.io" ? q.a : null,
      work: null,
      type: "inspiration",
      source: "zenquotes",
      verified: false,
      sourceConfidence: "high",
    });
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
    // Only enforce rate limit if no API key (free tier)
    if (!this.apiKey) {
      await this.enforceRateLimit();
    }

    try {
      // Build URL with optional API key appended to path (not query param)
      let url = `${this.baseUrl}/quotes`;
      if (this.apiKey) {
        url += `/${this.apiKey}`;
      }

      const response = await pRetry(
        async () => {
          const res = await fetch(url);
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
        .map(q => this.normalizeQuote(q));
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
