import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface TypefitQuote {
  text: string;
  author: string | null;
}

/**
 * Adapter for Type.fit Quotes API
 * Provides inspirational quotes from various authors
 * Completely free, no authentication required
 */
export class TypefitAdapter implements IQuoteSourceAdapter {
  name = "typefit";
  domain = "inspiration";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://type.fit/api/quotes";
  private cachedQuotes: TypefitQuote[] | null = null;

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      const allQuotes = await this.getAllQuotes();
      
      const filtered = allQuotes.filter(q => {
        const lowerQuery = query.toLowerCase();
        
        if (searchType === "author") {
          return q.author?.toLowerCase().includes(lowerQuery);
        } else if (searchType === "topic") {
          return q.text.toLowerCase().includes(lowerQuery);
        }
        
        return false;
      });

      return filtered
        .slice(0, maxResults)
        .map(q => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[TypefitAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const allQuotes = await this.getAllQuotes();
      
      const shuffled = [...allQuotes].sort(() => Math.random() - 0.5);
      
      return shuffled
        .slice(0, count)
        .map(q => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[TypefitAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async getAllQuotes(): Promise<TypefitQuote[]> {
    if (this.cachedQuotes) {
      return this.cachedQuotes;
    }

    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(this.baseUrl);
          if (!res.ok) {
            throw new Error(`Type.fit API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      this.cachedQuotes = response as TypefitQuote[];
      return this.cachedQuotes;
    } catch (error) {
      console.error(`[TypefitAdapter] Fetch error:`, error);
      return [];
    }
  }

  private normalizeQuote(quote: TypefitQuote): InsertQuote {
    return createNormalizedQuote({
      text: quote.text,
      speaker: null,
      author: quote.author?.replace(', type.fit', '').trim() || null,
      work: null,
      type: "inspiration",
      source: "typefit",
      verified: false,
      sourceConfidence: "medium",
    });
  }
}
