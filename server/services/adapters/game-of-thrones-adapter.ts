import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

/**
 * Adapter for Game of Thrones Quotes API
 * Free, no authentication required
 * https://api.gameofthronesquotes.xyz/
 */
export class GameOfThronesAdapter implements IQuoteSourceAdapter {
  name = "got-quotes";
  domain = "tv";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://api.gameofthronesquotes.xyz/v1";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Try character search if searching by author
      if (searchType === "author") {
        const charResponse = await pRetry(
          async () => {
            const res = await fetch(`${this.baseUrl}/author/${encodeURIComponent(query)}/2`);
            if (!res.ok) throw new Error(`GoT API returned ${res.status}`);
            return res.json();
          },
          { retries: 2, minTimeout: 1000 }
        );

        if (Array.isArray(charResponse)) {
          return charResponse
            .slice(0, maxResults)
            .map((q: any) => this.normalizeQuote(q.sentence, q.character?.name));
        }
      }

      // Fallback to random quotes and filter
      const randomQuotes = await this.fetchRandom(Math.max(maxResults * 2, 10));
      const lowerQuery = query.toLowerCase();
      return randomQuotes
        .filter(q =>
          q.quote.toLowerCase().includes(lowerQuery) ||
          (q.speaker && q.speaker.toLowerCase().includes(lowerQuery))
        )
        .slice(0, maxResults);
    } catch (error: any) {
      console.error(`[GameOfThronesAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    return this.fetchRandom(count);
  }

  private async fetchRandom(count: number): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/random/${Math.min(count, 10)}`);
          if (!res.ok) throw new Error(`GoT API returned ${res.status}`);
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = Array.isArray(response) ? response : [response];
      return data.map((q: any) => this.normalizeQuote(q.sentence, q.character?.name));
    } catch (error: any) {
      console.error(`[GameOfThronesAdapter] Random error:`, error.message);
      return [];
    }
  }

  private normalizeQuote(text: string, character?: string): InsertQuote {
    return createNormalizedQuote({
      text,
      speaker: character || null,
      author: "George R.R. Martin",
      work: "Game of Thrones",
      type: "tv",
      source: "got-quotes",
      verified: false,
      sourceConfidence: "medium",
    });
  }
}
