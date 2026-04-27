import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

/**
 * Adapter for They Said So Quotes API
 * Free tier: 10 requests/hour
 * https://quotes.rest/
 */
export class TheySaidSoAdapter implements IQuoteSourceAdapter {
  name = "they-said-so";
  domain = "inspiration";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 10; // 10 req/hour → ~0.17/min

  private baseUrl = "https://quotes.rest";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // They Said So supports category-based quotes
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/qod?language=en`, {
            headers: { Accept: "application/json" },
          });
          if (!res.ok) throw new Error(`They Said So API returned ${res.status}`);
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const quoteData = response?.contents?.quotes || [];
      return quoteData
        .slice(0, maxResults)
        .map((q: any) => this.normalizeQuote(q))
        .filter(Boolean) as InsertQuote[];
    } catch (error: any) {
      console.error(`[TheySaidSoAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    return this.search("", "topic", count);
  }

  private normalizeQuote(q: any): InsertQuote | null {
    if (!q?.quote) return null;
    return createNormalizedQuote({
      text: q.quote,
      speaker: null,
      author: q.author || null,
      work: q.title || null,
      type: "inspiration",
      source: "they-said-so",
      verified: false,
      sourceConfidence: "medium",
    });
  }
}
