import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";
import { config } from "../../config";

interface CelebrityLineResponse {
  id: number;
  quote: string;
  character: string;
  quoteFrom: string;
  actor: string;
  year: number;
}

/**
 * Adapter for Celebrity Lines API
 * Provides movie quotes with actor and character information
 * Requires paid API key subscription
 */
export class CelebrityLinesAdapter implements IQuoteSourceAdapter {
  name = "celebrity-lines";
  domain = "movie";
  requiresAuth = true;
  costPerCall = 0.001; // Estimate based on subscription tier
  rateLimit = 60;

  private baseUrl = "https://zylalabs.com/api";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.externalApis.celebrityLines.apiKey || "";
    if (!this.apiKey) {
      console.warn("[CelebrityLinesAdapter] No API key provided - adapter will not function");
    }
  }

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    if (!this.apiKey) {
      console.error("[CelebrityLinesAdapter] API key not configured");
      return [];
    }

    // Celebrity Lines API has limited search capabilities
    // For now, we'll get random quotes and filter client-side
    const quotes = await this.getRandom(Math.min(maxResults * 2, 20));
    
    let filtered = quotes;
    if (searchType === "author") {
      // Filter by actor name
      filtered = quotes.filter(q => 
        q.author?.toLowerCase().includes(query.toLowerCase())
      );
    } else if (searchType === "work") {
      // Filter by movie name
      filtered = quotes.filter(q => 
        q.work?.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return filtered.slice(0, maxResults);
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    if (!this.apiKey) {
      return [];
    }

    const quotes: InsertQuote[] = [];
    
    // Fetch random quotes (API may support batch, we'll call multiple times to be safe)
    const fetchCount = Math.min(count, 5);
    
    for (let i = 0; i < fetchCount; i++) {
      try {
        const quote = await this.fetchRandomQuote();
        if (quote) {
          quotes.push(quote);
        }
      } catch (error) {
        console.error(`[CelebrityLinesAdapter] Error fetching random quote:`, error);
      }
    }
    
    return quotes;
  }

  private async fetchRandomQuote(): Promise<InsertQuote | null> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(
            `${this.baseUrl}/1894/celebrity+lines+api/1587/get+random+actor+quote`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
              },
            }
          );
          if (!res.ok) {
            throw new Error(`Celebrity Lines API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as CelebrityLineResponse;
      
      return createNormalizedQuote({
        text: data.quote,
        speaker: data.character,
        author: data.actor,
        work: data.quoteFrom,
        year: data.year?.toString(),
        type: "movie",
        source: "celebrity-lines",
        verified: false,
        sourceConfidence: "high", // Professional API with curated content
      });
    } catch (error) {
      console.error(`[CelebrityLinesAdapter] Fetch error:`, error);
      return null;
    }
  }
}
