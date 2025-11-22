import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface PhilosophyApiQuote {
  id: number;
  quote: string;
  author: string;
  book?: string;
}

/**
 * Adapter for Philosophy API (philosophyapi.pythonanywhere.com)
 * Provides philosophy quotes with author information
 * Completely free, no authentication required
 */
export class PhilosophyApiAdapter implements IQuoteSourceAdapter {
  name = "philosophy-api";
  domain = "philosophy";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://philosophyapi.pythonanywhere.com/api";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      const quotes = await this.getAllQuotes();
      
      const filtered = quotes.filter(q => {
        const lowerQuery = query.toLowerCase();
        
        if (searchType === "author") {
          return q.author?.toLowerCase().includes(lowerQuery);
        } else if (searchType === "topic") {
          return q.quote.toLowerCase().includes(lowerQuery);
        } else if (searchType === "work") {
          return q.work?.toLowerCase().includes(lowerQuery);
        }
        
        return false;
      });

      return filtered.slice(0, maxResults);
    } catch (error: any) {
      console.error(`[PhilosophyApiAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const quotes = await this.getAllQuotes();
      
      const shuffled = [...quotes].sort(() => Math.random() - 0.5);
      
      return shuffled.slice(0, count);
    } catch (error: any) {
      console.error(`[PhilosophyApiAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async getAllQuotes(): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/quotes`);
          if (!res.ok) {
            throw new Error(`Philosophy API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as PhilosophyApiQuote[];
      
      return data.map(q => createNormalizedQuote({
        text: q.quote,
        speaker: null,
        author: q.author,
        work: q.book || null,
        type: "philosophy",
        source: "philosophy-api",
        verified: false,
        sourceConfidence: "high",
      }));
    } catch (error) {
      console.error(`[PhilosophyApiAdapter] Fetch error:`, error);
      return [];
    }
  }
}
