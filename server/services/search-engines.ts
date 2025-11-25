/**
 * Search Engine Services
 * Google Custom Search and Bing Web Search integration
 */

import axios from "axios";
import { config } from "../config";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "google" | "bing";
}

/**
 * Google Custom Search API
 * Requires GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID
 */
export async function searchGoogle(
  query: string,
  maxResults: number = 10
): Promise<SearchResult[]> {
  try {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
    
    if (!apiKey || !engineId) {
      console.log("Google Custom Search API not configured (missing API key or Engine ID)");
      return [];
    }
    
    const results: SearchResult[] = [];
    const numResults = Math.min(maxResults, 10); // Google API limits to 10 per request
    
    const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: apiKey,
        cx: engineId,
        q: query,
        num: numResults,
      },
      timeout: 15000,
    });
    
    const items = response.data.items || [];
    
    for (const item of items) {
      results.push({
        title: item.title || "",
        url: item.link || "",
        snippet: item.snippet || "",
        source: "google",
      });
    }
    
    console.log(`Google search returned ${results.length} results for: ${query}`);
    return results;
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.error("Google Custom Search rate limit exceeded");
    } else if (error.response?.status === 403) {
      console.error("Google Custom Search API key invalid or quota exceeded");
    } else {
      console.error("Google Custom Search error:", error.message);
    }
    return [];
  }
}

/**
 * Bing Web Search API
 * Requires BING_SEARCH_API_KEY
 */
export async function searchBing(
  query: string,
  maxResults: number = 10
): Promise<SearchResult[]> {
  try {
    const apiKey = process.env.BING_SEARCH_API_KEY;
    
    if (!apiKey) {
      console.log("Bing Search API not configured (missing API key)");
      return [];
    }
    
    const results: SearchResult[] = [];
    
    const response = await axios.get("https://api.bing.microsoft.com/v7.0/search", {
      params: {
        q: query,
        count: Math.min(maxResults, 50),
        mkt: "en-US",
        safeSearch: "Moderate",
      },
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      timeout: 15000,
    });
    
    const webPages = response.data.webPages?.value || [];
    
    for (const page of webPages) {
      results.push({
        title: page.name || "",
        url: page.url || "",
        snippet: page.snippet || "",
        source: "bing",
      });
    }
    
    console.log(`Bing search returned ${results.length} results for: ${query}`);
    return results;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error("Bing Search API key invalid");
    } else if (error.response?.status === 429) {
      console.error("Bing Search rate limit exceeded");
    } else {
      console.error("Bing Search error:", error.message);
    }
    return [];
  }
}

/**
 * Search both Google and Bing in parallel
 * Returns combined, deduplicated results
 */
export async function searchAllEngines(
  query: string,
  maxResultsPerEngine: number = 10
): Promise<SearchResult[]> {
  const [googleResults, bingResults] = await Promise.allSettled([
    searchGoogle(query, maxResultsPerEngine),
    searchBing(query, maxResultsPerEngine),
  ]);
  
  const allResults: SearchResult[] = [];
  
  if (googleResults.status === "fulfilled") {
    allResults.push(...googleResults.value);
  }
  
  if (bingResults.status === "fulfilled") {
    allResults.push(...bingResults.value);
  }
  
  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((r) => {
    const normalizedUrl = r.url.toLowerCase().replace(/\/$/, "");
    if (seen.has(normalizedUrl)) return false;
    seen.add(normalizedUrl);
    return true;
  });
  
  console.log(`Combined search engines found ${uniqueResults.length} unique results`);
  return uniqueResults;
}

/**
 * Generate multiple search queries and aggregate results
 */
export async function comprehensiveWebSearch(
  baseQuery: string,
  searchType: "topic" | "author" | "work",
  maxTotalResults: number = 30
): Promise<SearchResult[]> {
  // Generate multiple query variations
  const queries: string[] = [
    `${baseQuery} quotes`,
    `"${baseQuery}" famous quotes`,
  ];
  
  if (searchType === "author") {
    queries.push(`${baseQuery} best quotes wisdom`);
    queries.push(`${baseQuery} inspirational sayings`);
  } else if (searchType === "topic") {
    queries.push(`${baseQuery} sayings proverbs`);
    queries.push(`best ${baseQuery} quotes all time`);
  } else {
    queries.push(`${baseQuery} book quotes memorable`);
    queries.push(`famous lines from ${baseQuery}`);
  }
  
  // Run searches in parallel (limited to avoid rate limits)
  const resultsPerQuery = Math.ceil(maxTotalResults / queries.length);
  const allResults: SearchResult[] = [];
  
  // Process queries in batches of 2 to avoid overwhelming APIs
  for (let i = 0; i < queries.length; i += 2) {
    const batch = queries.slice(i, i + 2);
    
    const batchResults = await Promise.allSettled(
      batch.map((q) => searchAllEngines(q, resultsPerQuery))
    );
    
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        allResults.push(...result.value);
      }
    }
    
    // Small delay between batches
    if (i + 2 < queries.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  
  // Deduplicate and limit
  const seen = new Set<string>();
  const uniqueResults = allResults
    .filter((r) => {
      const normalizedUrl = r.url.toLowerCase().replace(/\/$/, "");
      if (seen.has(normalizedUrl)) return false;
      seen.add(normalizedUrl);
      return true;
    })
    .slice(0, maxTotalResults);
  
  console.log(`Comprehensive web search found ${uniqueResults.length} unique URLs`);
  return uniqueResults;
}
