import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface IndianQuoteAuthor {
  id: number;
  name: string;
  img: string;
  url: string;
  company: {
    id: number;
    name: string;
    url: string;
  };
}

interface IndianQuote {
  id: number;
  quote: string;
  tags: string[];
  author: IndianQuoteAuthor;
}

/**
 * Adapter for Indian Quotes API (Vercel)
 * Provides curated quotes from Indian entrepreneurs and business leaders
 * Free, no auth required, rate limit: 100 requests/minute
 */
export class IndianQuotesAdapter implements IQuoteSourceAdapter {
  name = "indian-quotes";
  domain = "business";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 100;

  private baseUrl = "https://indian-quotes-api.vercel.app/api/quotes";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Fetch random quotes and filter locally (API only has random endpoint)
      const quotes: InsertQuote[] = [];
      
      for (let i = 0; i < Math.min(maxResults * 3, 30); i++) {
        const quote = await this.getRandomQuote();
        if (quote) {
          const lowerQuery = query.toLowerCase();
          let matches = false;

          if (searchType === "author") {
            matches = quote.author?.toLowerCase().includes(lowerQuery) || false;
          } else if (searchType === "topic") {
            matches = quote.quote.toLowerCase().includes(lowerQuery);
          } else if (searchType === "work") {
            matches = quote.work?.toLowerCase().includes(lowerQuery) || false;
          }

          if (matches) {
            quotes.push(quote);
            if (quotes.length >= maxResults) break;
          }
        }
      }

      return quotes;
    } catch (error: any) {
      console.error(`[IndianQuotesAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const quotes: InsertQuote[] = [];
      const seen = new Set<string>();
      
      for (let i = 0; i < Math.min(count * 2, 20); i++) {
        const quote = await this.getRandomQuote();
        if (quote && !seen.has(quote.quote)) {
          seen.add(quote.quote);
          quotes.push(quote);
          if (quotes.length >= count) break;
        }
      }

      return quotes;
    } catch (error: any) {
      console.error(`[IndianQuotesAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async getRandomQuote(): Promise<InsertQuote | null> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/random`);
          if (!res.ok) {
            throw new Error(`Indian Quotes API returned ${res.status}`);
          }
          return res.json();
        },
        { retries: 2, minTimeout: 500 }
      );

      const data = response as IndianQuote;
      
      if (!data || !data.quote) return null;

      return createNormalizedQuote({
        text: data.quote,
        speaker: data.author?.name || null,
        author: data.author?.name || null,
        work: data.author?.company?.name || null,
        type: "business",
        source: "indian-quotes",
        verified: true,
        sourceConfidence: "high",
      });
    } catch (error: any) {
      console.error(`[IndianQuotesAdapter] Get random quote error:`, error.message);
      return null;
    }
  }
}
