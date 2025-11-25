import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface ReciteQuote {
  _id: string;
  quote: string;
  book: string;
  author: string;
  length: number;
  words: number;
}

/**
 * Adapter for Recite API
 * Provides quotes from novels and fiction books (45+ novels)
 * Free, no auth required, rate limit: 250 requests/minute
 */
export class ReciteAdapter implements IQuoteSourceAdapter {
  name = "recite";
  domain = "literary";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 250;

  private baseUrl = "https://recite.onrender.com/api/v1";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Fetch all quotes and filter locally
      const allQuotes = await this.fetchAllQuotes();
      
      const filtered = allQuotes.filter(q => {
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
      console.error(`[ReciteAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const quotes: InsertQuote[] = [];
      
      for (let i = 0; i < count; i++) {
        const response = await pRetry(
          async () => {
            const res = await fetch(`${this.baseUrl}/random`);
            if (!res.ok) {
              throw new Error(`Recite API returned ${res.status}`);
            }
            return res.json();
          },
          { retries: 2, minTimeout: 500 }
        );

        const data = response as ReciteQuote;
        
        if (data && data.quote) {
          quotes.push(createNormalizedQuote({
            text: data.quote,
            speaker: null,
            author: data.author || null,
            work: data.book || null,
            type: "literary",
            source: "recite",
            verified: true,
            sourceConfidence: "high",
          }));
        }
      }

      return quotes;
    } catch (error: any) {
      console.error(`[ReciteAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async fetchAllQuotes(): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/quotes`);
          if (!res.ok) {
            throw new Error(`Recite API returned ${res.status}`);
          }
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = response as ReciteQuote[];
      
      return data.map(q => createNormalizedQuote({
        text: q.quote,
        speaker: null,
        author: q.author || null,
        work: q.book || null,
        type: "literary",
        source: "recite",
        verified: true,
        sourceConfidence: "high",
      }));
    } catch (error: any) {
      console.error(`[ReciteAdapter] Fetch all error:`, error.message);
      return [];
    }
  }
}
