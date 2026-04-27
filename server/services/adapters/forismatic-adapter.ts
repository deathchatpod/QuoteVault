import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

/**
 * Adapter for Forismatic Quotes API
 * Free, no authentication required
 * http://api.forismatic.com/api/1.0/
 */
export class ForismaticAdapter implements IQuoteSourceAdapter {
  name = "forismatic";
  domain = "inspiration";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 30; // Conservative rate limit

  private baseUrl = "http://api.forismatic.com/api/1.0/";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    const quotes: InsertQuote[] = [];
    const attempts = Math.min(maxResults, 5);

    for (let i = 0; i < attempts; i++) {
      try {
        const q = await this.fetchRandomQuote();
        if (q) {
          const lowerQuery = query.toLowerCase();
          if (
            !query ||
            q.quoteText.toLowerCase().includes(lowerQuery) ||
            (q.quoteAuthor && q.quoteAuthor.toLowerCase().includes(lowerQuery))
          ) {
            quotes.push(this.normalizeQuote(q));
          }
        }
      } catch {
        // Individual fetch failures are ok
      }
    }

    return quotes;
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    const quotes: InsertQuote[] = [];
    const attempts = Math.min(count, 10);

    for (let i = 0; i < attempts; i++) {
      try {
        const q = await this.fetchRandomQuote();
        if (q) quotes.push(this.normalizeQuote(q));
      } catch {
        // Individual fetch failures are ok
      }
    }

    return quotes;
  }

  private async fetchRandomQuote(): Promise<any> {
    return pRetry(
      async () => {
        const res = await fetch(
          `${this.baseUrl}?method=getQuote&format=json&lang=en&key=${Math.floor(Math.random() * 1000000)}`
        );
        if (!res.ok) throw new Error(`Forismatic API returned ${res.status}`);
        return res.json();
      },
      { retries: 1, minTimeout: 500 }
    );
  }

  private normalizeQuote(q: any): InsertQuote {
    return createNormalizedQuote({
      text: q.quoteText.trim(),
      speaker: null,
      author: q.quoteAuthor?.trim() || null,
      work: null,
      type: "inspiration",
      source: "forismatic",
      verified: false,
      sourceConfidence: "medium",
    });
  }
}
