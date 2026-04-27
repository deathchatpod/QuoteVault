import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

/**
 * Adapter for Lucifer Quotes API
 * Free, no authentication required
 * https://lucifer-quotes.vercel.app/
 */
export class LuciferQuotesAdapter implements IQuoteSourceAdapter {
  name = "lucifer-quotes";
  domain = "tv";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 30; // Conservative rate limit

  private baseUrl = "https://lucifer-quotes.vercel.app/api/quotes";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      const allQuotes = await this.fetchAll();
      const lowerQuery = query.toLowerCase();

      const filtered = allQuotes.filter((q: any) => {
        if (searchType === "author") {
          return q.character?.toLowerCase().includes(lowerQuery);
        }
        return q.quote?.toLowerCase().includes(lowerQuery) ||
               q.character?.toLowerCase().includes(lowerQuery);
      });

      return filtered
        .slice(0, maxResults)
        .map((q: any) => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[LuciferQuotesAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/random`);
          if (!res.ok) throw new Error(`Lucifer API returned ${res.status}`);
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      // May return single or array
      const data = Array.isArray(response) ? response : [response];
      return data
        .slice(0, count)
        .map((q: any) => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[LuciferQuotesAdapter] Random error:`, error.message);
      return [];
    }
  }

  private async fetchAll(): Promise<any[]> {
    return pRetry(
      async () => {
        const res = await fetch(this.baseUrl);
        if (!res.ok) throw new Error(`Lucifer API returned ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      },
      { retries: 2, minTimeout: 1000 }
    );
  }

  private normalizeQuote(q: any): InsertQuote {
    return createNormalizedQuote({
      text: q.quote || q.text || "",
      speaker: q.character || null,
      author: null,
      work: "Lucifer",
      type: "tv",
      source: "lucifer-quotes",
      verified: false,
      sourceConfidence: "medium",
    });
  }
}
