import type { InsertQuote } from "@shared/schema";
import { quoteSourceRegistry } from "./quote-source-adapter";
import { rateLimitManager } from "./rate-limit-manager";

// Import working adapters only (removed broken: TVQuotes, Genius, CelebrityLines, MillerCenter, RevCom)
import { LyricsOvhAdapter } from "./adapters/lyrics-ovh-adapter";
import { APINinjasQuotesAdapter } from "./adapters/api-ninjas-quotes-adapter";
import { TypefitAdapter } from "./adapters/typefit-adapter";
import { ZenQuotesAdapter } from "./adapters/zenquotes-adapter";
import { AffirmationsDevAdapter } from "./adapters/affirmations-dev-adapter";
import { PhilosophyRestAdapter } from "./adapters/philosophy-rest-adapter";
import { PhilosophyApiAdapter } from "./adapters/philosophy-api-adapter";
import { PhilosophersApiAdapter } from "./adapters/philosophers-api-adapter";
import { Stands4PhrasesAdapter } from "./adapters/stands4-phrases-adapter";
import { AdviceSlipAdapter } from "./adapters/advice-slip-adapter";
import { MotivationalSparkAdapter } from "./adapters/motivational-spark-adapter";
import { IndianQuotesAdapter } from "./adapters/indian-quotes-adapter";
import { ReciteAdapter } from "./adapters/recite-adapter";
import { PoetryDBAdapter } from "./adapters/poetrydb-adapter";

// New free API adapters
import { TheySaidSoAdapter } from "./adapters/they-said-so-adapter";
import { ForismaticAdapter } from "./adapters/forismatic-adapter";
import { StoicQuotesAdapter } from "./adapters/stoic-quotes-adapter";
import { GameOfThronesAdapter } from "./adapters/game-of-thrones-adapter";
import { BreakingBadAdapter } from "./adapters/breaking-bad-adapter";
import { LuciferQuotesAdapter } from "./adapters/lucifer-quotes-adapter";

// Initialize and register all pop culture adapters
export function initializePopCultureAdapters() {
  const adapters = [
    // Free, reliable adapters
    new TypefitAdapter(),
    new ZenQuotesAdapter(),
    new AffirmationsDevAdapter(),
    new PhilosophersApiAdapter(),
    new PhilosophyApiAdapter(),
    new AdviceSlipAdapter(),
    new MotivationalSparkAdapter(),
    new IndianQuotesAdapter(),
    new ReciteAdapter(),
    new PoetryDBAdapter(),
    // New free API adapters
    new TheySaidSoAdapter(),
    new ForismaticAdapter(),
    new StoicQuotesAdapter(),
    new GameOfThronesAdapter(),
    new BreakingBadAdapter(),
    new LuciferQuotesAdapter(),
    // Adapters that may have issues or require keys
    new PhilosophyRestAdapter(), // May return 410
    new Stands4PhrasesAdapter(), // No API key by default
    new LyricsOvhAdapter(),
    new APINinjasQuotesAdapter(),
  ];

  for (const adapter of adapters) {
    quoteSourceRegistry.register(adapter);
    rateLimitManager.register(adapter.name, adapter.rateLimit);
  }

  console.log(`[PopCultureService] Registered ${adapters.length} adapters`);
}

/**
 * Search across all pop culture quote sources with intelligent prioritization
 * Uses Promise.allSettled for concurrent searches
 */
export async function searchPopCultureQuotes(
  query: string,
  searchType: "topic" | "author" | "work",
  maxQuotes: number
): Promise<{ quotes: InsertQuote[]; totalCost: number }> {
  let totalCost = 0;

  // Get all adapters, prioritizing free sources first
  const freeAdapters = quoteSourceRegistry.getFree();
  const paidAdapters = quoteSourceRegistry.getPaid();

  // Search all free sources concurrently
  const freeResults = await Promise.allSettled(
    freeAdapters.map(async (adapter) => {
      try {
        await rateLimitManager.acquire(adapter.name);
        const results = await adapter.search(query, searchType, Math.min(maxQuotes, 10));
        console.log(`[PopCultureService] ${adapter.name}: Found ${results.length} quotes`);
        return { quotes: results, cost: 0 };
      } catch (error: any) {
        console.error(`[PopCultureService] ${adapter.name} error:`, error.message);
        return { quotes: [] as InsertQuote[], cost: 0 };
      }
    })
  );

  // Collect free results
  const quotes: InsertQuote[] = [];
  for (const result of freeResults) {
    if (result.status === "fulfilled") {
      quotes.push(...result.value.quotes);
    }
  }

  // If we still need more quotes, use paid sources concurrently
  if (quotes.length < maxQuotes && paidAdapters.length > 0) {
    const paidResults = await Promise.allSettled(
      paidAdapters.map(async (adapter) => {
        try {
          await rateLimitManager.acquire(adapter.name);
          const results = await adapter.search(query, searchType, Math.min(maxQuotes, 10));
          const cost = results.length * adapter.costPerCall;
          console.log(`[PopCultureService] ${adapter.name}: Found ${results.length} quotes (cost: $${cost.toFixed(4)})`);
          return { quotes: results, cost };
        } catch (error: any) {
          console.error(`[PopCultureService] ${adapter.name} error:`, error.message);
          return { quotes: [] as InsertQuote[], cost: 0 };
        }
      })
    );

    for (const result of paidResults) {
      if (result.status === "fulfilled") {
        quotes.push(...result.value.quotes);
        totalCost += result.value.cost;
      }
    }
  }

  return { quotes: quotes.slice(0, maxQuotes), totalCost };
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

  const randomAdapters = adapters.filter(a => a.getRandom);

  const results = await Promise.allSettled(
    randomAdapters.map(async (adapter) => {
      try {
        await rateLimitManager.acquire(adapter.name);
        const perAdapter = Math.ceil(count / randomAdapters.length);
        const results = await adapter.getRandom!(perAdapter);
        return { quotes: results, cost: results.length * adapter.costPerCall };
      } catch (error: any) {
        console.error(`[PopCultureService] ${adapter.name} random error:`, error.message);
        return { quotes: [] as InsertQuote[], cost: 0 };
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      quotes.push(...result.value.quotes);
      totalCost += result.value.cost;
    }
  }

  return { quotes: quotes.slice(0, count), totalCost };
}
