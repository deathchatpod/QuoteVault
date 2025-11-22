import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface TVQuoteResponse {
  show: string;
  character: string;
  quote: string;
}

/**
 * Adapter for TV Quotes API (https://github.com/alakhpc/tv-quotes-api)
 * Provides 100,000+ quotes from various TV shows
 * Completely free, no authentication required
 */
export class TVQuotesAdapter implements IQuoteSourceAdapter {
  name = "tv-quotes-api";
  domain = "tv";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 60; // Conservative estimate

  private baseUrl = "https://tv-quotes-api.herokuapp.com/api";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    const quotes: InsertQuote[] = [];
    
    try {
      // Search by show name if searchType is "work"
      if (searchType === "work") {
        const showQuotes = await this.fetchQuotesByShow(query, maxResults);
        quotes.push(...showQuotes);
      }
      
      // For topic or author searches, get random quotes and filter
      // Since the API doesn't support text search, we'll get random quotes
      // This is a limitation of the TV Quotes API
      if (quotes.length < maxResults && (searchType === "topic" || searchType === "author")) {
        const randomQuotes = await this.getRandom(Math.min(maxResults * 3, 30));
        
        // Filter by character name if searching by author
        const filtered = searchType === "author"
          ? randomQuotes.filter(q => 
              q.speaker?.toLowerCase().includes(query.toLowerCase()) ||
              q.author?.toLowerCase().includes(query.toLowerCase())
            )
          : randomQuotes;
        
        quotes.push(...filtered.slice(0, maxResults - quotes.length));
      }
    } catch (error: any) {
      console.error(`[TVQuotesAdapter] Search error:`, error.message);
    }
    
    return quotes.slice(0, maxResults);
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    const quotes: InsertQuote[] = [];
    
    // API returns one quote at a time, so we need multiple calls
    const fetchCount = Math.min(count, 10); // Limit to 10 calls to be polite
    
    for (let i = 0; i < fetchCount; i++) {
      try {
        const quote = await this.fetchRandomQuote();
        if (quote) {
          quotes.push(quote);
        }
      } catch (error) {
        console.error(`[TVQuotesAdapter] Error fetching random quote:`, error);
      }
    }
    
    return quotes;
  }

  private async fetchRandomQuote(): Promise<InsertQuote | null> {
    try {
      const response = await pRetry(
        async () => {
          const res = await fetch(`${this.baseUrl}/random`);
          if (!res.ok) {
            throw new Error(`TV Quotes API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as TVQuoteResponse;
      
      return createNormalizedQuote({
        text: data.quote,
        speaker: data.character,
        author: null, // TV shows don't have single authors
        work: data.show,
        type: "tv",
        source: "tv-quotes-api",
        verified: false,
        sourceConfidence: "medium",
      });
    } catch (error) {
      console.error(`[TVQuotesAdapter] Fetch error:`, error);
      return null;
    }
  }

  private async fetchQuotesByShow(showName: string, maxResults: number): Promise<InsertQuote[]> {
    try {
      const response = await pRetry(
        async () => {
          const encodedShow = encodeURIComponent(showName);
          const res = await fetch(`${this.baseUrl}/random?show=${encodedShow}&number=${Math.min(maxResults, 10)}`);
          if (!res.ok) {
            throw new Error(`TV Quotes API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      // API can return single object or array
      const data = Array.isArray(response) ? response : [response];
      
      return data.map((item: TVQuoteResponse) => 
        createNormalizedQuote({
          text: item.quote,
          speaker: item.character,
          author: null,
          work: item.show,
          type: "tv",
          source: "tv-quotes-api",
          verified: false,
          sourceConfidence: "high", // Show-specific queries are more reliable
        })
      );
    } catch (error) {
      console.error(`[TVQuotesAdapter] Show search error:`, error);
      return [];
    }
  }
}
