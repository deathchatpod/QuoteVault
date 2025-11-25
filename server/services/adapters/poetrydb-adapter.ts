import type { IQuoteSourceAdapter } from "../quote-source-adapter";
import { createNormalizedQuote } from "../quote-source-adapter";
import type { InsertQuote } from "@shared/schema";
import pRetry from "p-retry";

interface Poem {
  title: string;
  author: string;
  lines: string[];
  linecount: string;
}

/**
 * Adapter for PoetryDB API
 * Provides classic poetry from ~130 authors and ~3,000 titles
 * Free, no auth required, no rate limit
 */
export class PoetryDBAdapter implements IQuoteSourceAdapter {
  name = "poetrydb";
  domain = "poetry";
  requiresAuth = false;
  costPerCall = 0;
  rateLimit = 60;

  private baseUrl = "https://poetrydb.org";

  async search(query: string, searchType: "topic" | "author" | "work", maxResults: number): Promise<InsertQuote[]> {
    try {
      let url: string;
      
      if (searchType === "author") {
        url = `${this.baseUrl}/author/${encodeURIComponent(query)}`;
      } else if (searchType === "work") {
        url = `${this.baseUrl}/title/${encodeURIComponent(query)}`;
      } else {
        // Topic search - search in poem lines
        url = `${this.baseUrl}/lines/${encodeURIComponent(query)}`;
      }

      const response = await pRetry(
        async () => {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`PoetryDB API returned ${res.status}`);
          }
          const text = await res.text();
          // Handle "404 Not Found" response
          if (text.includes("404") || text.includes("Not found")) {
            return [];
          }
          return JSON.parse(text);
        },
        { retries: 2, minTimeout: 1000 }
      );

      if (!Array.isArray(response)) {
        return [];
      }

      const poems = response as Poem[];
      
      return poems
        .slice(0, maxResults)
        .map(poem => this.poemToQuote(poem));
    } catch (error: any) {
      console.error(`[PoetryDBAdapter] Search error:`, error.message);
      return [];
    }
  }

  async getRandom(count: number): Promise<InsertQuote[]> {
    try {
      const quotes: InsertQuote[] = [];
      
      for (let i = 0; i < count; i++) {
        const response = await pRetry(
          async () => {
            const res = await fetch(`${this.baseUrl}/random`);
            if (!res.ok) {
              throw new Error(`PoetryDB API returned ${res.status}`);
            }
            return res.json();
          },
          { retries: 2, minTimeout: 500 }
        );

        const poems = response as Poem[];
        
        if (poems && poems.length > 0) {
          quotes.push(this.poemToQuote(poems[0]));
        }
      }

      return quotes;
    } catch (error: any) {
      console.error(`[PoetryDBAdapter] Get random error:`, error.message);
      return [];
    }
  }

  private poemToQuote(poem: Poem): InsertQuote {
    // Extract first 4 memorable lines as the quote
    const quoteLines = poem.lines
      .filter(line => line.trim().length > 0)
      .slice(0, 4);
    
    const quoteText = quoteLines.join(" / ");

    return createNormalizedQuote({
      text: quoteText,
      speaker: null,
      author: poem.author || null,
      work: poem.title || null,
      type: "poetry",
      source: "poetrydb",
      verified: true,
      sourceConfidence: "high",
    });
  }
}
