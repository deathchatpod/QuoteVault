import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

/**
 * Adapter for Breaking Bad Quotes API
 * Free, no authentication required
 * https://api.breakingbadquotes.xyz/
 */
export class BreakingBadAdapter implements IQuoteSourceAdapter {
  name = "breaking-bad";
  domain = "tv";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://api.breakingbadquotes.xyz/v1/quotes";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      const allQuotes = await this.fetchMultiple(Math.max(maxResults * 3, 20));
      const lowerQuery = query.toLowerCase();

      const filtered = allQuotes.filter(q => {
        if (searchType === "author") {
          return q.speaker?.toLowerCase().includes(lowerQuery);
        }
        return q.quote.toLowerCase().includes(lowerQuery) ||
               (q.speaker && q.speaker.toLowerCase().includes(lowerQuery));
      });

      return filtered.slice(0, maxResults);
    } catch (error: any) {
      console.error(`[BreakingBadAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    return this.fetchMultiple(count);
  }

  private async fetchMultiple(count: number): Promise<InsertQuote[]> {
    try {
      const batchSize = Math.min(count, 10);
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/${batchSize}`);
          if (!res.ok) throw new Error(`Breaking Bad API returned ${res.status}`);
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = Array.isArray(response) ? response : [response];
      return data.map((q: any) => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[BreakingBadAdapter] Fetch error:`, error.message);
      return [];
    }
  }

  private normalizeQuote(q: any): InsertQuote {
    return createNormalizedQuote({
      text: q.quote,
      speaker: q.author || null,
      author: "Vince Gilligan",
      work: "Breaking Bad",
      type: "tv",
      source: "breaking-bad",
      verified: false,
      sourceConfidence: "medium",
    });
  }
}
