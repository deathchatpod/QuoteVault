import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface AdviceSlip {
  id: number;
  advice: string;
}

interface AdviceResponse {
  slip: AdviceSlip;
}

interface AdviceSearchResponse {
  total_results: string;
  slips: AdviceSlip[];
}

/**
 * Adapter for Advice Slip API
 * Provides fortune cookie-style actionable life advice
 * Free, no auth required, rate limit: 1 request per 2 seconds
 */
export class AdviceSlipAdapter implements IQuoteSourceAdapter {
  name = "advice-slip";
  domain = "advice";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 30; // 1 per 2 seconds = 30 per minute

  private baseUrl = "https://api.adviceslip.com";
  private lastRequestTime = 0;
  private readonly minRequestInterval = 2000; // 2 seconds between requests

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Only topic search makes sense for advice
      if (searchType !== "topic") {
        return [];
      }

      await this.enforceRateLimit();

      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/advice/search/${encodeURIComponent(query)}`, {
            cache: "no-cache",
          });
          if (!res.ok) {
            if (res.status === 404) {
              return { total_results: "0", slips: [] };
            }
            throw new Error(`Advice Slip API returned ${res.status}`);
          }
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = response as AdviceSearchResponse;
      
      if (!data.slips || data.slips.length === 0) {
        return [];
      }

      return data.slips
        .slice(0, maxResults)
        .map(slip => createNormalizedQuote({
          text: slip.advice,
          speaker: null,
          author: "Advice Slip",
          work: null,
          type: "advice",
          source: "advice-slip",
          verified: true,
          sourceConfidence: "high",
        }));
    } catch (error: any) {
      console.error(`[AdviceSlipAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const quotes: InsertQuote[] = [];
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        await this.enforceRateLimit();

        const response = await pRetry(
          async () => {
            const res = await fetch(`${this.baseUrl}/advice`, {
              cache: "no-cache",
            });
            if (!res.ok) {
              throw new Error(`Advice Slip API returned ${res.status}`);
            }
            return res.json();
          },
          { retries: 2, minTimeout: 1000 }
        );

        const data = response as AdviceResponse;
        
        if (data.slip) {
          quotes.push(createNormalizedQuote({
            text: data.slip.advice,
            speaker: null,
            author: "Advice Slip",
            work: null,
            type: "advice",
            source: "advice-slip",
            verified: true,
            sourceConfidence: "high",
          }));
        }
      }

      return quotes;
    } catch (error: any) {
      console.error(`[AdviceSlipAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}
