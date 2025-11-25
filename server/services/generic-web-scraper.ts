/**
 * Generic Web Scraper
 * Extracts potential quotes from arbitrary web pages found by search engines
 */

import axios from "axios";
import * as cheerio from "cheerio";
import type { SearchResult } from "./search-engines";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT = 12000;

export interface ExtractedContent {
  url: string;
  title: string;
  quotes: Array<{
    text: string;
    possibleAuthor: string | null;
    context: string | null;
  }>;
  rawText: string;
}

/**
 * Extract quotes from a single web page
 */
export async function scrapeWebPage(url: string): Promise<ExtractedContent> {
  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      maxRedirects: 3,
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove script, style, nav, footer elements
    $("script, style, nav, footer, header, aside, .sidebar, .advertisement, .ad").remove();
    
    const title = $("title").text().trim() || $("h1").first().text().trim();
    const quotes: ExtractedContent["quotes"] = [];
    
    // Strategy 1: Look for blockquotes
    $("blockquote").each((_, element) => {
      const text = $(element).text().trim();
      if (isValidQuoteText(text)) {
        // Try to find nearby author attribution
        const cite = $(element).find("cite, footer, .author").text().trim();
        const nextSibling = $(element).next().text().trim();
        const possibleAuthor = cite || (nextSibling.startsWith("—") || nextSibling.startsWith("-") 
          ? nextSibling.replace(/^[—–-]\s*/, "").split(",")[0].trim() 
          : null);
        
        quotes.push({
          text: cleanQuoteText(text),
          possibleAuthor,
          context: null,
        });
      }
    });
    
    // Strategy 2: Look for quote-specific classes
    $("[class*='quote'], [class*='Quote'], [class*='saying'], [id*='quote']").each((_, element) => {
      const text = $(element).text().trim();
      if (isValidQuoteText(text) && !quotes.some(q => q.text === cleanQuoteText(text))) {
        const authorElement = $(element).find("[class*='author'], [class*='Author'], cite");
        quotes.push({
          text: cleanQuoteText(text),
          possibleAuthor: authorElement.text().trim() || null,
          context: null,
        });
      }
    });
    
    // Strategy 3: Look for text in quotation marks
    const bodyText = $("body").text();
    const quotePatterns = [
      /"([^"]{20,500})"/g,           // Standard quotes
      /"([^"]{20,500})"/g,           // Smart quotes
      /「([^」]{20,500})」/g,          // Japanese quotes
      /«([^»]{20,500})»/g,           // French quotes
    ];
    
    for (const pattern of quotePatterns) {
      let match;
      while ((match = pattern.exec(bodyText)) !== null) {
        const text = match[1].trim();
        if (isValidQuoteText(text) && !quotes.some(q => q.text === cleanQuoteText(text))) {
          // Try to extract author from surrounding text
          const surroundingText = bodyText.substring(
            Math.max(0, match.index - 50),
            Math.min(bodyText.length, match.index + match[0].length + 100)
          );
          const authorMatch = surroundingText.match(/[—–-]\s*([A-Z][a-z]+ [A-Z][a-z]+)/);
          
          quotes.push({
            text: cleanQuoteText(text),
            possibleAuthor: authorMatch?.[1] || null,
            context: null,
          });
        }
        
        if (quotes.length >= 50) break;
      }
      if (quotes.length >= 50) break;
    }
    
    // Strategy 4: Look for list items that look like quotes
    $("li, p").each((_, element) => {
      if (quotes.length >= 50) return false;
      
      const text = $(element).text().trim();
      
      // Look for quote + attribution pattern
      const quotePattern = /^[""]?(.{20,400})[""]?\s*[—–-]\s*([A-Z][a-zA-Z\s.]+)$/;
      const match = text.match(quotePattern);
      
      if (match) {
        const quoteText = match[1].trim();
        const author = match[2].trim();
        
        if (isValidQuoteText(quoteText) && !quotes.some(q => q.text === cleanQuoteText(quoteText))) {
          quotes.push({
            text: cleanQuoteText(quoteText),
            possibleAuthor: author,
            context: null,
          });
        }
      }
    });
    
    // Get cleaned raw text for AI processing
    const rawText = $("main, article, .content, #content, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 10000); // Limit to 10KB
    
    return {
      url,
      title,
      quotes,
      rawText,
    };
  } catch (error: any) {
    console.error(`Failed to scrape ${url}: ${error.message}`);
    return {
      url,
      title: "",
      quotes: [],
      rawText: "",
    };
  }
}

/**
 * Check if text looks like a valid quote
 */
function isValidQuoteText(text: string): boolean {
  if (!text) return false;
  
  const cleaned = text.trim();
  
  // Length check
  if (cleaned.length < 15 || cleaned.length > 1000) return false;
  
  // Should have more than 3 words
  if (cleaned.split(/\s+/).length < 4) return false;
  
  // Exclude navigation/UI elements
  const excludePatterns = [
    /^(click|tap|read more|continue|see more|view|share|tweet|email)/i,
    /^(home|about|contact|menu|search|login|sign)/i,
    /^\d+\s*(comments?|shares?|likes?|views?)/i,
    /^(copyright|©|\(c\)|all rights reserved)/i,
    /^(cookie|privacy|terms|policy)/i,
    /(\.jpg|\.png|\.gif|\.svg)$/i,
  ];
  
  for (const pattern of excludePatterns) {
    if (pattern.test(cleaned)) return false;
  }
  
  return true;
}

/**
 * Clean and normalize quote text
 */
function cleanQuoteText(text: string): string {
  return text
    .replace(/\s+/g, " ")           // Normalize whitespace
    .replace(/^[""\s]+/, "")         // Remove leading quotes/spaces
    .replace(/[""\s]+$/, "")         // Remove trailing quotes/spaces
    .replace(/[—–-]\s*$/, "")        // Remove trailing attribution markers
    .trim();
}

/**
 * Scrape multiple URLs with proper concurrency control
 */
export async function scrapeMultipleUrls(
  searchResults: SearchResult[],
  maxUrls: number = 20,
  concurrency: number = 3
): Promise<ExtractedContent[]> {
  // Dynamic import to avoid circular dependencies
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(concurrency);
  
  const urlsToScrape = searchResults.slice(0, maxUrls);
  const results: ExtractedContent[] = [];
  
  // Use p-limit for proper concurrency control
  const scrapePromises = urlsToScrape.map((result) =>
    limit(async () => {
      try {
        const content = await scrapeWebPage(result.url);
        // Add delay between requests to be respectful
        await new Promise((resolve) => setTimeout(resolve, 200));
        return content;
      } catch (error) {
        console.error(`Failed to scrape ${result.url}`);
        return null;
      }
    })
  );
  
  const scrapeResults = await Promise.all(scrapePromises);
  
  for (const result of scrapeResults) {
    if (result && (result.quotes.length > 0 || result.rawText.length > 100)) {
      results.push(result);
    }
  }
  
  console.log(`Generic scraper extracted content from ${results.length} pages`);
  return results;
}

/**
 * Aggregate all extracted quotes from multiple pages with full metadata
 */
export function aggregateScrapedQuotes(
  scrapedPages: ExtractedContent[],
  searchType: "topic" | "author" | "work" = "topic"
): Array<{ 
  quote: string; 
  speaker: string | null; 
  author: string | null; 
  work: string | null; 
  type: string;
  reference: string | null;
  sources: string[];
  sourceUrl: string;
}> {
  const quotes: Array<{ 
    quote: string; 
    speaker: string | null; 
    author: string | null; 
    work: string | null; 
    type: string;
    reference: string | null;
    sources: string[];
    sourceUrl: string;
  }> = [];
  const seen = new Set<string>();
  
  // Infer quote type from search type
  const inferredType = searchType === "author" ? "attributed" : 
                       searchType === "work" ? "literature" : "general";
  
  for (const page of scrapedPages) {
    for (const q of page.quotes) {
      const normalized = q.text.toLowerCase().trim();
      
      if (!seen.has(normalized)) {
        seen.add(normalized);
        const domain = extractDomain(page.url);
        quotes.push({
          quote: q.text,
          speaker: q.possibleAuthor,
          author: q.possibleAuthor,
          work: null,
          type: inferredType,
          reference: page.url,
          sources: [`web-${domain}`],
          sourceUrl: page.url,
        });
      }
    }
  }
  
  return quotes;
}

/**
 * Extract domain from URL for source attribution
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    return "web";
  }
}

/**
 * Get raw text content from pages for AI extraction
 */
export function getRawTextForAI(
  scrapedPages: ExtractedContent[],
  maxTextLength: number = 50000
): string {
  const texts: string[] = [];
  let totalLength = 0;
  
  for (const page of scrapedPages) {
    if (totalLength >= maxTextLength) break;
    
    if (page.rawText) {
      const textToAdd = page.rawText.substring(0, maxTextLength - totalLength);
      texts.push(`--- Source: ${page.url} ---\n${textToAdd}`);
      totalLength += textToAdd.length;
    }
  }
  
  return texts.join("\n\n");
}
