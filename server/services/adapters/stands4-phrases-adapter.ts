import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";
import { parseStringPromise } from "xml2js";

interface Stands4Result {
  result: {
    phrase?: Array<{
      term: string[];
      definition: string[];
      example?: string[];
    }>;
  };
}

/**
 * Adapter for STANDS4 Phrases API
 * Provides idiom and phrase definitions
 * Free tier available with registration
 */
export class Stands4PhrasesAdapter implements IQuoteSourceAdapter {
  name = "stands4-phrases";
  domain = "idioms";
  requiresAuth = true;
  costPerCall = 0;
  rateLimit = 60; // Conservative estimate

  private baseUrl = "https://www.stands4.com/services/v2/phrases.php";
  private uid: string | null;
  private tokenId: string | null;

  constructor(uid?: string, tokenId?: string) {
    this.uid = uid || null;
    this.tokenId = tokenId || null;
  }

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    if (!this.uid || !this.tokenId) {
      console.log("[Stands4PhrasesAdapter] No API credentials provided - adapter disabled");
      return [];
    }

    if (searchType !== "topic") {
      return [];
    }

    try {
      const phrases = await this.searchPhrases(query);
      return phrases.slice(0, maxResults);
    } catch (error: any) {
      console.error(`[Stands4PhrasesAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    return [];
  }

  private async searchPhrases(phrase: string): Promise<InsertQuote[]> {
    if (!this.uid || !this.tokenId) {
      return [];
    }

    try {
      const url = `${this.baseUrl}?uid=${this.uid}&tokenid=${this.tokenId}&phrase=${encodeURIComponent(phrase)}&format=xml`;
      
      const response = await pRetry(
        async () => {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`STANDS4 Phrases API returned ${res.status}`);
          }
          return res.text();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const parsed = await parseStringPromise(response) as Stands4Result;
      
      if (!parsed.result?.phrase) {
        return [];
      }

      return parsed.result.phrase.map(p => {
        const term = p.term?.[0] || phrase;
        const definition = p.definition?.[0] || "";
        const example = p.example?.[0];

        const text = example || term;
        const reference = definition;

        return createNormalizedQuote({
          text,
          speaker: null,
          author: null,
          work: "Idioms & Phrases",
          type: "idiom",
          reference,
          source: "stands4-phrases",
          verified: true,
          sourceConfidence: "high",
        });
      });
    } catch (error) {
      console.error(`[Stands4PhrasesAdapter] Fetch error:`, error);
      return [];
    }
  }
}
