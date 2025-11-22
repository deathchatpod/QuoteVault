import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface PhilosophyRestQuote {
  philosopher: string;
  quote: string;
  school?: string;
}

/**
 * Adapter for Philosophy.rest API
 * Provides quotes from philosophers organized by philosophical schools
 * Completely free, no authentication required
 */
export class PhilosophyRestAdapter implements IQuoteSourceAdapter {
  name = "philosophy-rest";
  domain = "philosophy";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://philosophy-quotes-api.glitch.me";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      if (searchType === "author") {
        return await this.searchByPhilosopher(query, maxResults);
      } else if (searchType === "topic") {
        return await this.searchByTopic(query, maxResults);
      }
      
      return [];
    } catch (error: any) {
      console.error(`[PhilosophyRestAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    const quotes: InsertQuote[] = [];
    
    const fetchCount = Math.min(count, 20);
    
    for (let i = 0; i < fetchCount; i++) {
      try {
        const quote = await this.fetchRandomQuote();
        if (quote) {
          quotes.push(quote);
        }
      } catch (error) {
        console.error(`[PhilosophyRestAdapter] Error fetching random quote:`, error);
      }
    }
    
    return quotes;
  }

  private async fetchRandomQuote(): Promise<InsertQuote | null> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/quotes/random`);
          if (!res.ok) {
            throw new Error(`Philosophy.rest API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as PhilosophyRestQuote;
      
      return this.normalizeQuote(data);
    } catch (error) {
      console.error(`[PhilosophyRestAdapter] Fetch error:`, error);
      return null;
    }
  }

  private async searchByPhilosopher(philosopher: string, maxResults: number): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const encodedName = encodeURIComponent(philosopher);
          const res = await fetch(`${this.baseUrl}/quotes/philosopher/${encodedName}`);
          if (!res.ok) {
            if (res.status === 404) {
              return [];
            }
            throw new Error(`Philosophy.rest API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = Array.isArray(response) ? response : [response];
      
      return data
        .slice(0, maxResults)
        .map((q: PhilosophyRestQuote) => this.normalizeQuote(q));
    } catch (error) {
      console.error(`[PhilosophyRestAdapter] Philosopher search error:`, error);
      return [];
    }
  }

  private async searchByTopic(query: string, maxResults: number): Promise<InsertQuote[]> {
    const quotes: InsertQuote[] = [];
    
    try {
      // Fetch random quotes and filter by topic
      const fetchCount = Math.min(maxResults * 3, 30);
      
      for (let i = 0; i < fetchCount && quotes.length < maxResults; i++) {
        const quote = await this.fetchRandomQuote();
        if (quote && quote.quote.toLowerCase().includes(query.toLowerCase())) {
          quotes.push(quote);
        }
      }
    } catch (error) {
      console.error(`[PhilosophyRestAdapter] Topic search error:`, error);
    }
    
    return quotes.slice(0, maxResults);
  }

  private normalizeQuote(data: PhilosophyRestQuote): InsertQuote {
    return createNormalizedQuote({
      text: data.quote,
      speaker: null,
      author: data.philosopher,
      work: data.school || null,
      type: "philosophy",
      reference: data.school || null,
      source: "philosophy-rest",
      verified: false,
      sourceConfidence: "high",
    });
  }
}
