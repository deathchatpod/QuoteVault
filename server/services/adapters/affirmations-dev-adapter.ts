import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface AffirmationResponse {
  affirmation: string;
}

/**
 * Adapter for Affirmations.dev API
 * Provides positive affirmations for mental health
 * Completely free, no authentication required
 */
export class AffirmationsDevAdapter implements IQuoteSourceAdapter {
  name = "affirmations-dev";
  domain = "affirmations";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 0; // No documented rate limit

  private baseUrl = "https://www.affirmations.dev";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    const affirmations: InsertQuote[] = [];
    
    try {
      // Fetch multiple affirmations and filter by query
      const fetchCount = Math.min(maxResults * 3, 30);
      
      for (let i = 0; i < fetchCount && affirmations.length < maxResults; i++) {
        const affirmation = await this.fetchAffirmation();
        if (affirmation) {
          const text = affirmation.quote.toLowerCase();
          const queryLower = query.toLowerCase();
          
          // Filter by topic (text contains query)
          if (searchType === "topic" && text.includes(queryLower)) {
            affirmations.push(affirmation);
          } else if (searchType === "author") {
            // Affirmations don't have authors, skip
            continue;
          }
        }
      }
    } catch (error: any) {
      console.error(`[AffirmationsDevAdapter] Search error:`, error.message);
    }
    
    return affirmations.slice(0, maxResults);
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    const affirmations: InsertQuote[] = [];
    
    const fetchCount = Math.min(count, 20);
    
    for (let i = 0; i < fetchCount; i++) {
      try {
        const affirmation = await this.fetchAffirmation();
        if (affirmation) {
          affirmations.push(affirmation);
        }
      } catch (error) {
        console.error(`[AffirmationsDevAdapter] Error fetching affirmation:`, error);
      }
    }
    
    return affirmations;
  }

  private async fetchAffirmation(): Promise<InsertQuote | null> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(this.baseUrl);
          if (!res.ok) {
            throw new Error(`Affirmations.dev API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as AffirmationResponse;
      
      return createNormalizedQuote({
        text: data.affirmation,
        speaker: null,
        author: null,
        work: null,
        type: "affirmation",
        source: "affirmations-dev",
        verified: true,
        sourceConfidence: "high",
      });
    } catch (error) {
      console.error(`[AffirmationsDevAdapter] Fetch error:`, error);
      return null;
    }
  }
}
