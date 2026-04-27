import { computeQuoteSimilarity, SIMILARITY_THRESHOLD, clusterQuotesBySimilarity } from "./quote-similarity";
import { quoteSourceRegistry } from "./quote-source-adapter";
import { rateLimitManager } from "./rate-limit-manager";
import type { InsertQuote } from "@shared/schema";

interface MatchDetail {
  source: string;
  matchedText: string;
  similarity: number;
}

interface CrossVerifyResult {
  status: "cross_verified" | "single_source";
  matchingSources: string[];
  matchDetails: MatchDetail[];
}

/**
 * Tier 1: Passive Source Agreement
 * During search, after collecting quotes from all sources, group by similarity.
 * Any quote cluster with 2+ distinct source origins → cross_verified
 */
export function passiveSourceAgreement(
  allQuotes: Array<{ quote: string; sources: string[]; [key: string]: any }>
): Array<{
  quotes: typeof allQuotes;
  distinctSources: string[];
  verificationStatus: "cross_verified" | "single_source";
  bestQuote: typeof allQuotes[number];
}> {
  const clusters = clusterQuotesBySimilarity(allQuotes);

  return clusters.map(cluster => {
    // Collect all distinct source origins across the cluster
    const allSources = new Set<string>();
    for (const q of cluster) {
      const sources = Array.isArray(q.sources) ? q.sources : [];
      for (const s of sources) {
        allSources.add(s);
      }
    }

    const distinctSources = Array.from(allSources);
    const verificationStatus = distinctSources.length >= 2 ? "cross_verified" : "single_source";

    // Pick the "best" quote: prefer the one with the most metadata
    const bestQuote = cluster.reduce((best, current) => {
      const bestScore = metadataCompleteness(best);
      const currentScore = metadataCompleteness(current);
      return currentScore > bestScore ? current : best;
    }, cluster[0]);

    return { quotes: cluster, distinctSources, verificationStatus, bestQuote };
  });
}

/**
 * Score metadata completeness: author, work, year, reference
 */
function metadataCompleteness(q: any): number {
  let score = 0;
  if (q.author) score++;
  if (q.work) score++;
  if (q.year) score++;
  if (q.reference) score++;
  if (q.speaker) score++;
  return score;
}

/**
 * Tier 2: Active Cross-Source Lookup
 * For single_source quotes, actively search other adapters using author + first words
 */
export async function activeCrossSourceLookup(
  quoteText: string,
  author: string | null,
  existingSources: string[],
  maxAdaptersToCheck: number = 3
): Promise<CrossVerifyResult> {
  const matchingSources: string[] = [...existingSources];
  const matchDetails: MatchDetail[] = [];

  // Get adapters to check, excluding ones already in existing sources
  const allAdapters = quoteSourceRegistry.getFree();
  const adaptersToCheck = allAdapters
    .filter(a => !existingSources.includes(a.name))
    .slice(0, maxAdaptersToCheck);

  // Build a search query from author + first few words of quote
  const firstWords = quoteText.split(" ").slice(0, 5).join(" ");
  const searchQuery = author || firstWords;

  const results = await Promise.allSettled(
    adaptersToCheck.map(async (adapter) => {
      try {
        await rateLimitManager.acquire(adapter.name);
        const searchType = author ? "author" : "topic";
        const adapterResults = await adapter.search(searchQuery, searchType as any, 10);

        for (const result of adapterResults) {
          const similarity = computeQuoteSimilarity(quoteText, result.quote);
          if (similarity >= SIMILARITY_THRESHOLD) {
            return {
              source: adapter.name,
              matchedText: result.quote,
              similarity,
            };
          }
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      matchingSources.push(result.value.source);
      matchDetails.push(result.value);
    }
  }

  const distinctSources = Array.from(new Set(matchingSources));
  return {
    status: distinctSources.length >= 2 ? "cross_verified" : "single_source",
    matchingSources: distinctSources,
    matchDetails,
  };
}

/**
 * Batch cross-verify multiple quotes using Tier 2 active lookup
 */
export async function batchCrossVerify(
  quotes: Array<{
    id: string;
    quote: string;
    author: string | null;
    sources: string[];
  }>,
  maxAdaptersPerQuote: number = 3
): Promise<Array<{ id: string; result: CrossVerifyResult }>> {
  const results: Array<{ id: string; result: CrossVerifyResult }> = [];

  // Process sequentially to avoid overwhelming adapters
  for (const q of quotes) {
    const result = await activeCrossSourceLookup(
      q.quote,
      q.author,
      q.sources,
      maxAdaptersPerQuote
    );
    results.push({ id: q.id, result });
  }

  return results;
}
