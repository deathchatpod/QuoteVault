import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface LyricsOvhResponse {
  lyrics: string;
}

/**
 * Adapter for Lyrics.ovh API
 * Provides song lyrics by artist and title
 * Completely free, no authentication required
 */
export class LyricsOvhAdapter implements IQuoteSourceAdapter {
  name = "lyrics-ovh";
  domain = "music";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 30; // Conservative estimate

  private baseUrl = "https://api.lyrics.ovh/v1";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    // Lyrics.ovh requires both artist and title, so it's limited for general searches
    // We'll only return results if searchType is "author" (artist) or "work" (song title)
    
    if (searchType === "author") {
      // Try to fetch lyrics for common songs by this artist
      // This is a limitation - we'd need a song database to do this properly
      return [];
    }
    
    if (searchType === "work") {
      // Parse if query contains "artist - title" format
      const parts = query.split("-").map(p => p.trim());
      if (parts.length === 2) {
        const [artist, title] = parts;
        const lyrics = await this.fetchLyrics(artist, title);
        return lyrics ? [lyrics] : [];
      }
    }
    
    return [];
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    // Lyrics.ovh doesn't support random lyrics
    return [];
  }

  async fetchLyrics(artist: string, title: string): Promise<InsertQuote | null> {
    try {
      const response = await pRetry(
        async () => {
          const encodedArtist = encodeURIComponent(artist);
          const encodedTitle = encodeURIComponent(title);
          const res = await fetch(`${this.baseUrl}/${encodedArtist}/${encodedTitle}`);
          if (!res.ok) {
            throw new Error(`Lyrics.ovh API returned ${res.status}`);
          }
          return res.json();
        },
        {
          retries: 2,
          minTimeout: 1000,
        }
      );

      const data = response as LyricsOvhResponse;
      
      if (!data.lyrics) {
        return null;
      }
      
      // Extract first verse/chorus as quote (lyrics can be very long)
      const excerpt = this.extractExcerpt(data.lyrics);
      
      return createNormalizedQuote({
        text: excerpt,
        speaker: artist, // The artist is the "speaker"
        author: artist,
        work: title,
        type: "music",
        reference: `Song: ${title}`,
        source: "lyrics-ovh",
        verified: false,
        sourceConfidence: "high", // Lyrics.ovh is reliable
      });
    } catch (error) {
      console.error(`[LyricsOvhAdapter] Fetch error for ${artist} - ${title}:`, error);
      return null;
    }
  }

  private extractExcerpt(lyrics: string): string {
    // Take first 4 lines or first verse (whichever is shorter)
    const lines = lyrics.split('\n').filter(line => line.trim().length > 0);
    
    // Find first blank line (verse separator)
    let endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '');
    if (endIndex === -1 || endIndex > 8) {
      endIndex = Math.min(4, lines.length);
    }
    
    return lines.slice(0, endIndex).join('\n').trim();
  }
}
