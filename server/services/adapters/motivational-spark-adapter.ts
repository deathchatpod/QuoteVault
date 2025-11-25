import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface MotivationalQuote {
  id: number;
  quote: string;
  author: string;
}

/**
 * Adapter for Motivational Spark API (Vercel)
 * Provides curated motivational quotes with 100% uptime
 * Free, no auth required, CORS enabled
 */
export class MotivationalSparkAdapter implements IQuoteSourceAdapter {
  name = "motivational-spark";
  domain = "motivation";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 60;

  private baseUrl = "https://motivational-spark-api.vercel.app/api";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Fetch all quotes and filter locally
      const allQuotes = await this.fetchAllQuotes();
      
      const filtered = allQuotes.filter(q => {
        const lowerQuery = query.toLowerCase();
        
        if (searchType === "author") {
          return q.author?.toLowerCase().includes(lowerQuery);
        } else if (searchType === "topic") {
          return q.quote.toLowerCase().includes(lowerQuery);
        }
        
        return false;
      });

      return filtered.slice(0, maxResults);
    } catch (error: any) {
      console.error(`[MotivationalSparkAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      // Use the random endpoint for multiple quotes
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/quotes/random/${count}`);
          if (!res.ok) {
            throw new Error(`Motivational Spark API returned ${res.status}`);
          }
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = Array.isArray(response) ? response : [response];
      
      return data.map((q: MotivationalQuote) => createNormalizedQuote({
        text: q.quote,
        speaker: null,
        author: q.author || null,
        work: null,
        type: "motivation",
        source: "motivational-spark",
        verified: true,
        sourceConfidence: "high",
      }));
    } catch (error: any) {
      console.error(`[MotivationalSparkAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async fetchAllQuotes(): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/quotes`);
          if (!res.ok) {
            throw new Error(`Motivational Spark API returned ${res.status}`);
          }
          return res.json();
        },
        { retries: 2, minTimeout: 1000 }
      );

      const data = response as MotivationalQuote[];
      
      return data.map(q => createNormalizedQuote({
        text: q.quote,
        speaker: null,
        author: q.author || null,
        work: null,
        type: "motivation",
        source: "motivational-spark",
        verified: true,
        sourceConfidence: "high",
      }));
    } catch (error: any) {
      console.error(`[MotivationalSparkAdapter] Fetch all error:`, error.message);
      return [];
    }
  }
}
