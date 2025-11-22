import type { InsertQuote } from "@shared/schema";
import { quoteSourceRegistry } from "./quote-source-adapter";
import { rateLimitManager } from "./rate-limit-manager";

// Import all adapters
import { TVQuotesAdapter } from "./adapters/tv-quotes-adapter";
import { LyricsOvhAdapter } from "./adapters/lyrics-ovh-adapter";
import { GeniusAdapter } from "./adapters/genius-adapter";
import { CelebrityLinesAdapter } from "./adapters/celebrity-lines-adapter";
import { APINinjasQuotesAdapter } from "./adapters/api-ninjas-quotes-adapter";
import { MillerCenterAdapter } from "./adapters/miller-center-adapter";
import { RevComAdapter } from "./adapters/rev-com-adapter";

// Initialize and register all pop culture adapters
export function initializePopCultureAdapters() {
  const adapters = [
    new TVQuotesAdapter(),
    new LyricsOvhAdapter(),
    new GeniusAdapter(),
    new CelebrityLinesAdapter(),
    new APINinjasQuotesAdapter(),
    new MillerCenterAdapter(),
    new RevComAdapter(),
  ];

  for (const adapter of adapters) {
    quoteSourceRegistry.register(adapter);
    rateLimitManager.register(adapter.name, adapter.rateLimit);
  }

  console.log(`[PopCultureService] Registered ${adapters.length} adapters`);
}

/**
 * Search across all pop culture quote sources with intelligent prioritization
 */
export async function searchPopCultureQuotes(
  query: string,
  searchType: "topic" | "author" | "work",
  maxQuotes: number
): Promise<{ quotes: InsertQuote[]; totalCost: number }> {
  const quotes: InsertQuote[] = [];
  let totalCost = 0;

  // Get all adapters, prioritizing free sources first
  const freeAdapters = quoteSourceRegistry.getFree();
  const paidAdapters = quoteSourceRegistry.getPaid();

  // Search free sources first
  for (const adapter of freeAdapters) {
    if (quotes.length >= maxQuotes) {
      break;
    }

    try {
      await rateLimitManager.acquire(adapter.name);
      
      const remainingQuotes = maxQuotes - quotes.length;
      const results = await adapter.search(query, searchType, remainingQuotes);
      
      quotes.push(...results);
      console.log(`[PopCultureService] ${adapter.name}: Found ${results.length} quotes`);
    } catch (error: any) {
      console.error(`[PopCultureService] ${adapter.name} error:`, error.message);
    }
  }

  // If we still need more quotes, use paid sources
  if (quotes.length < maxQuotes) {
    for (const adapter of paidAdapters) {
      if (quotes.length >= maxQuotes) {
        break;
      }

      try {
        await rateLimitManager.acquire(adapter.name);
        
        const remainingQuotes = maxQuotes - quotes.length;
        const results = await adapter.search(query, searchType, remainingQuotes);
        
        quotes.push(...results);
        totalCost += results.length * adapter.costPerCall;
        console.log(`[PopCultureService] ${adapter.name}: Found ${results.length} quotes (cost: $${(results.length * adapter.costPerCall).toFixed(4)})`);
      } catch (error: any) {
        console.error(`[PopCultureService] ${adapter.name} error:`, error.message);
      }
    }
  }

  return { quotes, totalCost };
}

/**
 * Get random quotes from pop culture sources
 */
export async function getRandomPopCultureQuotes(
  count: number,
  domain?: string
): Promise<{ quotes: InsertQuote[]; totalCost: number }> {
  const quotes: InsertQuote[] = [];
  let totalCost = 0;

  const adapters = domain
    ? quoteSourceRegistry.getByDomain(domain)
    : quoteSourceRegistry.getAll();

  for (const adapter of adapters) {
    if (quotes.length >= count) {
      break;
    }

    if (!adapter.getRandom) {
      continue;
    }

    try {
      await rateLimitManager.acquire(adapter.name);
      
      const remainingQuotes = count - quotes.length;
      const results = await adapter.getRandom(remainingQuotes);
      
      quotes.push(...results);
      totalCost += results.length * adapter.costPerCall;
    } catch (error: any) {
      console.error(`[PopCultureService] ${adapter.name} random error:`, error.message);
    }
  }

  return { quotes, totalCost };
}
