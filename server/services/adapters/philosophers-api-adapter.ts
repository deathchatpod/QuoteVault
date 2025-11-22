import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface PhilosophersApiQuote {
  id: string;
  philosopherID: string;
  work: string;
  year: string;
  quote: string;
}

/**
 * Adapter for Philosophers API (philosophersapi.com)
 * Provides scholarly verified quotes with full metadata
 * Completely free, no authentication required
 */
export class PhilosophersApiAdapter implements IQuoteSourceAdapter {
  name = "philosophers-api";
  domain = "philosophy";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://philosophersapi.com/api";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      // Get all quotes and filter
      const quotes = await this.getQuotes(maxResults * 2);
      
      const filtered = quotes.filter(q => {
        const lowerQuery = query.toLowerCase();
        
        if (searchType === "author") {
          return q.author?.toLowerCase().includes(lowerQuery);
        } else if (searchType === "topic") {
          return q.quote.toLowerCase().includes(lowerQuery);
        } else if (searchType === "work") {
          return q.work?.toLowerCase().includes(lowerQuery);
        }
        
        return false;
      });

      return filtered.slice(0, maxResults);
    } catch (error: any) {
      console.error(`[PhilosophersApiAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      return await this.getQuotes(count);
    } catch (error: any) {
      console.error(`[PhilosophersApiAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private async getQuotes(count: number): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/quotes?limit=${Math.min(count, 50)}`);
          if (!res.ok) {
            throw new Error(`Philosophers API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = Array.isArray(response) ? response : [response];
      
      return data.map((q: PhilosophersApiQuote) => createNormalizedQuote({
        text: q.quote,
        speaker: null,
        author: this.extractAuthorFromWork(q.work),
        work: q.work,
        year: q.year,
        type: "philosophy",
        reference: q.work,
        source: "philosophers-api",
        verified: true, // Scholarly source
        sourceConfidence: "high",
      }));
    } catch (error) {
      console.error(`[PhilosophersApiAdapter] Fetch error:`, error);
      return [];
    }
  }

  private extractAuthorFromWork(work: string): string | null {
    // Work format is often "Quoted by [Author] in [Work]"
    const match = work.match(/(?:Quoted by|by)\s+([^,]+)/i);
    return match ? match[1].trim() : null;
  }
}
