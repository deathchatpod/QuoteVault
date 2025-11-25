/**
 * Intelligent Query Generator
 * Expands search terms into multiple smart variations for comprehensive quote discovery
 */

export interface QueryVariation {
  query: string;
  type: "primary" | "synonym" | "context" | "site-specific";
  weight: number; // Higher weight = more important
}

const QUOTE_KEYWORDS = [
  "quotes",
  "famous quotes",
  "sayings",
  "wisdom",
  "best quotes",
  "inspiring quotes",
  "famous sayings",
];

const AUTHOR_SUFFIXES = [
  "quotes",
  "famous quotes",
  "best quotes",
  "wisdom",
  "sayings",
  "inspirational quotes",
];

const TOPIC_SYNONYMS: Record<string, string[]> = {
  love: ["romance", "affection", "heart", "passion", "devotion"],
  life: ["living", "existence", "journey", "experience"],
  success: ["achievement", "accomplishment", "victory", "winning"],
  happiness: ["joy", "bliss", "contentment", "fulfillment"],
  wisdom: ["knowledge", "insight", "understanding", "enlightenment"],
  friendship: ["friends", "companionship", "bonds", "loyalty"],
  courage: ["bravery", "fearless", "strength", "valor"],
  death: ["mortality", "passing", "end", "loss"],
  hope: ["optimism", "faith", "aspiration", "dreams"],
  fear: ["anxiety", "worry", "dread", "terror"],
  time: ["moments", "hours", "days", "eternity"],
  change: ["transformation", "evolution", "growth", "transition"],
  truth: ["honesty", "reality", "authenticity", "sincerity"],
  freedom: ["liberty", "independence", "emancipation"],
  peace: ["tranquility", "serenity", "harmony", "calm"],
  money: ["wealth", "fortune", "prosperity", "riches"],
  power: ["strength", "authority", "influence", "control"],
  beauty: ["elegance", "grace", "charm", "loveliness"],
  nature: ["earth", "environment", "wilderness", "outdoors"],
  family: ["relatives", "kinship", "heritage", "ancestry"],
};

const QUOTE_SITES = [
  "brainyquote.com",
  "goodreads.com/quotes",
  "azquotes.com",
  "quotegarden.com",
  "wikiquote.org",
  "quotationspage.com",
  "quotefancy.com",
  "inspiringquotes.us",
];

/**
 * Generate intelligent query variations for comprehensive search
 */
export function generateQueryVariations(
  query: string,
  searchType: "topic" | "author" | "work",
  maxVariations: number = 15
): QueryVariation[] {
  const variations: QueryVariation[] = [];
  const normalizedQuery = query.toLowerCase().trim();

  // Primary query with quote keywords
  variations.push({
    query: `"${query}" quotes`,
    type: "primary",
    weight: 1.0,
  });

  if (searchType === "author") {
    // Author-specific variations
    for (const suffix of AUTHOR_SUFFIXES.slice(0, 4)) {
      variations.push({
        query: `${query} ${suffix}`,
        type: "primary",
        weight: 0.9,
      });
    }

    // Try full name variations
    const nameParts = query.split(" ");
    if (nameParts.length >= 2) {
      const lastName = nameParts[nameParts.length - 1];
      variations.push({
        query: `${lastName} famous quotes`,
        type: "context",
        weight: 0.7,
      });
    }
  } else if (searchType === "topic") {
    // Topic-specific variations
    for (const keyword of QUOTE_KEYWORDS.slice(0, 4)) {
      variations.push({
        query: `${query} ${keyword}`,
        type: "primary",
        weight: 0.9,
      });
    }

    // Add synonyms if available
    const synonyms = TOPIC_SYNONYMS[normalizedQuery];
    if (synonyms) {
      for (const synonym of synonyms.slice(0, 3)) {
        variations.push({
          query: `${synonym} quotes`,
          type: "synonym",
          weight: 0.6,
        });
      }
    }

    // Add proverb/saying variations
    variations.push({
      query: `${query} proverbs sayings`,
      type: "context",
      weight: 0.7,
    });
  } else if (searchType === "work") {
    // Work-specific variations
    variations.push({
      query: `"${query}" book quotes`,
      type: "primary",
      weight: 0.9,
    });
    variations.push({
      query: `${query} famous lines`,
      type: "context",
      weight: 0.8,
    });
    variations.push({
      query: `${query} memorable quotes`,
      type: "context",
      weight: 0.8,
    });
  }

  // Site-specific queries for search engines
  for (const site of QUOTE_SITES.slice(0, 4)) {
    variations.push({
      query: `site:${site} ${query}`,
      type: "site-specific",
      weight: 0.85,
    });
  }

  // Sort by weight and limit
  return variations
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxVariations);
}

/**
 * Generate search-engine friendly queries
 */
export function generateSearchEngineQueries(
  query: string,
  searchType: "topic" | "author" | "work"
): string[] {
  const queries: string[] = [];

  // Main query with quotes keyword
  queries.push(`${query} quotes`);
  queries.push(`"${query}" famous quotes`);

  if (searchType === "author") {
    queries.push(`${query} best quotes wisdom`);
    queries.push(`${query} inspirational quotes`);
  } else if (searchType === "topic") {
    queries.push(`${query} sayings proverbs`);
    queries.push(`best ${query} quotes of all time`);
    queries.push(`famous ${query} quotes by great thinkers`);
  } else {
    queries.push(`${query} book quotes passages`);
    queries.push(`memorable lines from ${query}`);
  }

  return queries;
}

/**
 * Extract potential quote site URLs from search results
 */
export function filterQuoteSiteUrls(urls: string[]): string[] {
  const quoteSiteDomains = [
    "brainyquote.com",
    "goodreads.com",
    "azquotes.com",
    "quotegarden.com",
    "wikiquote.org",
    "quotationspage.com",
    "quotefancy.com",
    "inspiringquotes.us",
    "quotemaster.org",
    "thinkexist.com",
    "notable-quotes.com",
    "famousquotes.com",
    "quodb.com",
  ];

  return urls.filter((url) => {
    const urlLower = url.toLowerCase();
    return quoteSiteDomains.some((domain) => urlLower.includes(domain));
  });
}

/**
 * Score a URL based on its likelihood of containing quality quotes
 */
export function scoreQuoteUrl(url: string): number {
  const urlLower = url.toLowerCase();
  let score = 0.5;

  // High-quality quote sites
  if (urlLower.includes("brainyquote.com")) score += 0.4;
  if (urlLower.includes("goodreads.com/quotes")) score += 0.4;
  if (urlLower.includes("wikiquote.org")) score += 0.35;
  if (urlLower.includes("azquotes.com")) score += 0.3;
  if (urlLower.includes("quotegarden.com")) score += 0.25;

  // Medium-quality sources
  if (urlLower.includes("quotes")) score += 0.15;
  if (urlLower.includes("sayings")) score += 0.1;
  if (urlLower.includes("wisdom")) score += 0.1;

  // Reduce score for potentially low-quality sources
  if (urlLower.includes("pinterest")) score -= 0.3;
  if (urlLower.includes("facebook")) score -= 0.3;
  if (urlLower.includes("twitter") || urlLower.includes("x.com")) score -= 0.2;

  return Math.min(1, Math.max(0, score));
}
