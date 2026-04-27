// Common English stopwords to ignore for similarity matching
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "that", "this",
  "these", "those", "it", "its", "not", "no", "so", "if", "as", "up",
  "out", "about", "into", "over", "after", "all", "also", "than",
  "then", "only", "just", "more", "very", "too", "such",
]);

/**
 * Normalize text for comparison: lowercase, strip punctuation, collapse whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get significant words (non-stopwords) from text
 */
function getSignificantWords(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Token-set Jaccard similarity: intersection / union of word sets
 */
function jaccardSimilarity(wordsA: string[], wordsB: string[]): number {
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let intersection = 0;
  setA.forEach(word => {
    if (setB.has(word)) intersection++;
  });

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Prefix match on first N significant words
 */
function prefixMatchScore(wordsA: string[], wordsB: string[], n: number = 5): number {
  const prefixA = wordsA.slice(0, n);
  const prefixB = wordsB.slice(0, n);

  if (prefixA.length === 0 || prefixB.length === 0) return 0;

  let matches = 0;
  const maxLen = Math.max(prefixA.length, prefixB.length);

  for (let i = 0; i < Math.min(prefixA.length, prefixB.length); i++) {
    if (prefixA[i] === prefixB[i]) matches++;
  }

  return matches / maxLen;
}

/**
 * Compute similarity between two quote strings.
 * Returns 0-1 score. Threshold for "same quote" is >= 0.75
 *
 * Algorithm:
 * - Token-set Jaccard similarity (word overlap) — weight 0.6
 * - Prefix match on first 5 significant words — weight 0.4
 */
export function computeQuoteSimilarity(a: string, b: string): number {
  const wordsA = getSignificantWords(a);
  const wordsB = getSignificantWords(b);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const jaccard = jaccardSimilarity(wordsA, wordsB);
  const prefix = prefixMatchScore(wordsA, wordsB, 5);

  return jaccard * 0.6 + prefix * 0.4;
}

/**
 * Threshold for considering two quotes as the "same" quote
 */
export const SIMILARITY_THRESHOLD = 0.75;

/**
 * Group quotes into clusters by similarity
 */
export function clusterQuotesBySimilarity(
  quotes: Array<{ quote: string; sources: string[]; [key: string]: any }>,
  threshold: number = SIMILARITY_THRESHOLD
): Array<Array<typeof quotes[number]>> {
  const clusters: Array<Array<typeof quotes[number]>> = [];
  const assigned = new Set<number>();

  for (let i = 0; i < quotes.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [quotes[i]];
    assigned.add(i);

    for (let j = i + 1; j < quotes.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = computeQuoteSimilarity(quotes[i].quote, quotes[j].quote);
      if (similarity >= threshold) {
        cluster.push(quotes[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}
