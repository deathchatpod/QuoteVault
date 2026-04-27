import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface StoicQuote {
  body: string;
  author: string;
}

/**
 * Adapter for Stoic Quotes API
 * Free, no authentication required
 * https://stoicquotesapi.com/
 */
export class StoicQuotesAdapter implements IQuoteSourceAdapter {
  name = "stoic-quotes";
  domain = "philosophy";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://stoicquotesapi.com/v1/api/quotes";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      const allQuotes = await this.fetchQuotes();
      const lowerQuery = query.toLowerCase();

      const filtered = allQuotes.filter(q => {
        if (searchType === "author") {
          return q.author?.toLowerCase().includes(lowerQuery);
        }
        return q.body.toLowerCase().includes(lowerQuery) ||
               q.author?.toLowerCase().includes(lowerQuery);
      });

      return filtered
        .slice(0, maxResults)
        .map(q => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[StoicQuotesAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/random`);
          if (!res.ok) throw new Error(`Stoic Quotes API returned ${res.status}`);
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      // API may return single quote or array
      const quotes = Array.isArray(response) ? response : [response];
      return quotes
        .slice(0, count)
        .map((q: any) => this.normalizeQuote(q));
    } catch (error: any) {
      console.error(`[StoicQuotesAdapter] Random error:`, error.message);
      return [];
    }
  }

  private async fetchQuotes(): Promise<StoicQuote[]> {
    return pRetry(
      async () => {
        const res = await fetch(this.baseUrl);
        if (!res.ok) throw new Error(`Stoic Quotes API returned ${res.status}`);
        return res.json();
      },
      { retries: 2, minTimeout: 1000 }
    );
  }

  private normalizeQuote(q: StoicQuote): InsertQuote {
    return createNormalizedQuote({
      text: q.body,
      speaker: null,
      author: q.author || null,
      work: null,
      type: "literature",
      source: "stoic-quotes",
      verified: false,
      sourceConfidence: "medium",
    });
  }
}
