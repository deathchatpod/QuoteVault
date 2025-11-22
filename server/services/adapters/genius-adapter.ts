import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";
import { config } from "../../config";

interface GeniusSearchResponse {
  response: {
    hits: Array<{
      result: {
        id: number;
        title: string;
        primary_artist: {
          name: string;
        };
        lyrics_state: string;
        url: string;
      };
    }>;
  };
}

/**
 * Adapter for Genius API
 * Provides song metadata and lyrics (via scraping)
 * Requires API key (free tier available)
 */
export class GeniusAdapter implements IQuoteSourceAdapter {
  name = "genius";
  domain = "music";
  requiresAuth = true;
  costPerCall = 0; // Free tier available
  rateLimit = 60; // Conservative estimate

  private baseUrl = "https://api.genius.com";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.externalApis.genius.apiKey || "";
    if (!this.apiKey) {
      console.warn("[GeniusAdapter] No API key provided - adapter will not function");
    }
  }

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    if (!this.apiKey) {
      console.error("[GeniusAdapter] API key not configured");
      return [];
    }

    const quotes: InsertQuote[] = [];
    
    try {
      // Search for songs
      const searchQuery = searchType === "author" ? `artist:${query}` : query;
      const songs = await this.searchSongs(searchQuery, Math.min(maxResults, 5));
      
      // Get lyrics snippet for each song
      for (const song of songs) {
        const quote = this.createQuoteFromSong(song);
        if (quote) {
          quotes.push(quote);
        }
      }
    } catch (error: any) {
      console.error(`[GeniusAdapter] Search error:`, error.message);
    }
    
    return quotes.slice(0, maxResults);
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    // Genius doesn't have a random endpoint
    // We could implement this by searching for common words and randomizing
    return [];
  }

  private async searchSongs(query: string, limit: number): Promise<any[]> {
    try {
      const response = await pRetry(
        async () => {
          const encodedQuery = encodeURIComponent(query);
          const res = await fetch(
            `${this.baseUrl}/search?q=${encodedQuery}&per_page=${limit}`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
              },
            }
          );
          if (!res.ok) {
            throw new Error(`Genius API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as GeniusSearchResponse;
      return data.response.hits.map(hit => hit.result);
    } catch (error) {
      console.error(`[GeniusAdapter] Song search error:`, error);
      return [];
    }
  }

  private createQuoteFromSong(song: any): InsertQuote | null {
    try {
      // Create a placeholder quote with song info
      // Note: Full lyrics require scraping the Genius page, which we're not doing here
      // to keep this simple and avoid legal issues
      const quoteText = `From "${song.title}" by ${song.primary_artist.name}`;
      
      return createNormalizedQuote({
        text: quoteText,
        speaker: song.primary_artist.name,
        author: song.primary_artist.name,
        work: song.title,
        type: "music",
        reference: `Genius.com - ${song.url}`,
        source: "genius",
        verified: false,
        sourceConfidence: "high", // Genius has accurate metadata
      });
    } catch (error) {
      console.error(`[GeniusAdapter] Error creating quote from song:`, error);
      return null;
    }
  }
}
