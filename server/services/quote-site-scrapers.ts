/**
 * Quote Site Scrapers
 * Dedicated scrapers for popular quote websites
 */

import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TIMEOUT = 15000;

interface ScrapedQuote {
  quote: string;
  speaker: string | null;
  author: string | null;
  work: string | null;
  sources: string[];
}

/**
 * Rate limit delay between requests to same domain
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrape BrainyQuote for quotes
 * https://www.brainyquote.com
 */
export async function scrapeBrainyQuote(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 50
): Promise<ScrapedQuote[]> {
  try {
    const quotes: ScrapedQuote[] = [];
    const encodedQuery = encodeURIComponent(query.toLowerCase().replace(/\s+/g, "_"));
    
    // Try topic page first, then search
    const urls = searchType === "author" 
      ? [`https://www.brainyquote.com/authors/${encodedQuery}`]
      : [`https://www.brainyquote.com/topics/${encodedQuery}-quotes`];
    
    // Also add search page
    urls.push(`https://www.brainyquote.com/search_results?q=${encodeURIComponent(query)}`);
    
    for (const url of urls) {
      if (quotes.length >= maxResults) break;
      
      try {
        const response = await axios.get(url, {
          timeout: TIMEOUT,
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract quotes from the page
        $(".clearfix").each((_, element) => {
          if (quotes.length >= maxResults) return false;
          
          const quoteText = $(element).find(".b-qt, .bqQt").text().trim();
          const authorText = $(element).find(".bq-aut, .bqQuoteLink a").text().trim();
          
          if (quoteText && quoteText.length > 10 && quoteText.length < 1000) {
            quotes.push({
              quote: quoteText,
              speaker: authorText || null,
              author: authorText || null,
              work: null,
              sources: ["brainyquote"],
            });
          }
        });
        
        // Alternative selector for newer layout
        $("a.b-qt").each((_, element) => {
          if (quotes.length >= maxResults) return false;
          
          const quoteText = $(element).text().trim();
          const authorLink = $(element).closest(".m-brick").find("a.bq-aut");
          const authorText = authorLink.text().trim();
          
          if (quoteText && quoteText.length > 10 && quoteText.length < 1000) {
            // Check for duplicate
            if (!quotes.some(q => q.quote === quoteText)) {
              quotes.push({
                quote: quoteText,
                speaker: authorText || null,
                author: authorText || null,
                work: null,
                sources: ["brainyquote"],
              });
            }
          }
        });
        
        await delay(500); // Rate limit between requests
      } catch (err) {
        // Continue to next URL
        console.log(`BrainyQuote URL failed: ${url}`);
      }
    }
    
    return quotes;
  } catch (error) {
    console.error("BrainyQuote scraping error:", error);
    return [];
  }
}

/**
 * Scrape Goodreads Quotes
 * https://www.goodreads.com/quotes
 */
export async function scrapeGoodreadsQuotes(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 50
): Promise<ScrapedQuote[]> {
  try {
    const quotes: ScrapedQuote[] = [];
    
    // Build search URL
    const searchUrl = `https://www.goodreads.com/quotes/search?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(searchUrl, {
      timeout: TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract quotes from search results
    $(".quoteDetails").each((_, element) => {
      if (quotes.length >= maxResults) return false;
      
      const quoteText = $(element).find(".quoteText").clone().children().remove().end().text().trim();
      const authorSpan = $(element).find(".authorOrTitle");
      const authorText = authorSpan.first().text().replace(/,\s*$/, "").trim();
      
      // Extract book title if available
      const titleSpan = $(element).find(".authorOrTitle").eq(1);
      const workText = titleSpan.text().trim() || null;
      
      // Clean quote text - remove "―" attribution
      const cleanQuote = quoteText.split("―")[0].trim().replace(/^[""]|[""]$/g, "").trim();
      
      if (cleanQuote && cleanQuote.length > 10 && cleanQuote.length < 1000) {
        quotes.push({
          quote: cleanQuote,
          speaker: authorText || null,
          author: authorText || null,
          work: workText,
          sources: ["goodreads-quotes"],
        });
      }
    });
    
    // Alternative selector
    $(".quote").each((_, element) => {
      if (quotes.length >= maxResults) return false;
      
      const quoteText = $(element).find(".quoteText, .quoteBody").text().trim();
      const authorText = $(element).find(".quoteAuthor, .authorName").text().trim();
      
      const cleanQuote = quoteText.split("―")[0].trim().replace(/^[""]|[""]$/g, "").trim();
      
      if (cleanQuote && cleanQuote.length > 10 && cleanQuote.length < 1000) {
        if (!quotes.some(q => q.quote === cleanQuote)) {
          quotes.push({
            quote: cleanQuote,
            speaker: authorText || null,
            author: authorText || null,
            work: null,
            sources: ["goodreads-quotes"],
          });
        }
      }
    });
    
    return quotes;
  } catch (error) {
    console.error("Goodreads Quotes scraping error:", error);
    return [];
  }
}

/**
 * Scrape AZQuotes
 * https://www.azquotes.com
 */
export async function scrapeAZQuotes(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 50
): Promise<ScrapedQuote[]> {
  try {
    const quotes: ScrapedQuote[] = [];
    const encodedQuery = encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-"));
    
    // Try different URL patterns
    const urls = searchType === "author"
      ? [`https://www.azquotes.com/author/${encodedQuery}`]
      : [`https://www.azquotes.com/quotes/topics/${encodedQuery}.html`];
    
    // Add search URL
    urls.push(`https://www.azquotes.com/search_results.html?q=${encodeURIComponent(query)}`);
    
    for (const url of urls) {
      if (quotes.length >= maxResults) break;
      
      try {
        const response = await axios.get(url, {
          timeout: TIMEOUT,
          headers: {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract quotes
        $(".wrap-block").each((_, element) => {
          if (quotes.length >= maxResults) return false;
          
          const quoteText = $(element).find("a.title, p.title").text().trim();
          const authorText = $(element).find(".author a, .author").text().trim();
          
          if (quoteText && quoteText.length > 10 && quoteText.length < 1000) {
            quotes.push({
              quote: quoteText,
              speaker: authorText || null,
              author: authorText || null,
              work: null,
              sources: ["azquotes"],
            });
          }
        });
        
        // Alternative selector
        $("li.quote").each((_, element) => {
          if (quotes.length >= maxResults) return false;
          
          const quoteText = $(element).find(".text, q").text().trim();
          const authorText = $(element).find(".author").text().trim();
          
          if (quoteText && quoteText.length > 10 && !quotes.some(q => q.quote === quoteText)) {
            quotes.push({
              quote: quoteText,
              speaker: authorText || null,
              author: authorText || null,
              work: null,
              sources: ["azquotes"],
            });
          }
        });
        
        await delay(500);
      } catch (err) {
        console.log(`AZQuotes URL failed: ${url}`);
      }
    }
    
    return quotes;
  } catch (error) {
    console.error("AZQuotes scraping error:", error);
    return [];
  }
}

/**
 * Scrape QuoteGarden
 * https://www.quotegarden.com
 */
export async function scrapeQuoteGarden(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 50
): Promise<ScrapedQuote[]> {
  try {
    const quotes: ScrapedQuote[] = [];
    
    // QuoteGarden uses simple topic-based URLs
    const topicSlug = query.toLowerCase().replace(/\s+/g, "");
    const url = `https://www.quotegarden.com/${topicSlug}.html`;
    
    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      
      const $ = cheerio.load(response.data);
      
      // QuoteGarden uses simple blockquote or div structure
      $("blockquote, .quote, div[class*='quote']").each((_, element) => {
        if (quotes.length >= maxResults) return false;
        
        const text = $(element).text().trim();
        
        // Try to extract author from the format "Quote ~ Author"
        const parts = text.split(/[~—–-]/);
        const quoteText = parts[0].trim().replace(/^[""]|[""]$/g, "");
        const authorText = parts[1]?.trim() || null;
        
        if (quoteText && quoteText.length > 10 && quoteText.length < 1000) {
          quotes.push({
            quote: quoteText,
            speaker: authorText,
            author: authorText,
            work: null,
            sources: ["quotegarden"],
          });
        }
      });
      
      // Alternative: look for text with quote patterns
      $("p, div").each((_, element) => {
        if (quotes.length >= maxResults) return false;
        
        const text = $(element).text().trim();
        
        // Look for quotes with attribution pattern
        const quoteMatch = text.match(/^[""](.+?)[""][\s]*[~—–-][\s]*(.+)$/);
        if (quoteMatch) {
          const quoteText = quoteMatch[1].trim();
          const authorText = quoteMatch[2].trim();
          
          if (quoteText.length > 10 && !quotes.some(q => q.quote === quoteText)) {
            quotes.push({
              quote: quoteText,
              speaker: authorText,
              author: authorText,
              work: null,
              sources: ["quotegarden"],
            });
          }
        }
      });
    } catch (err) {
      console.log(`QuoteGarden topic not found: ${topicSlug}`);
    }
    
    return quotes;
  } catch (error) {
    console.error("QuoteGarden scraping error:", error);
    return [];
  }
}

/**
 * Scrape QuotationsPage
 * https://www.quotationspage.com
 */
export async function scrapeQuotationsPage(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 50
): Promise<ScrapedQuote[]> {
  try {
    const quotes: ScrapedQuote[] = [];
    
    const searchUrl = `https://www.quotationspage.com/search.php3?Search=${encodeURIComponent(query)}&startsearch=Search&Author=&C=mgm&C=motivate&C=classic&C=coles&C=poor&C=lindsly`;
    
    const response = await axios.get(searchUrl, {
      timeout: TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract quotes from search results
    $("dt.quote, .quote").each((_, element) => {
      if (quotes.length >= maxResults) return false;
      
      const quoteText = $(element).find("a").first().text().trim() || $(element).text().trim();
      const authorElement = $(element).next("dd").find("a").first();
      const authorText = authorElement.text().trim() || null;
      
      if (quoteText && quoteText.length > 10 && quoteText.length < 1000) {
        quotes.push({
          quote: quoteText.replace(/^[""]|[""]$/g, ""),
          speaker: authorText,
          author: authorText,
          work: null,
          sources: ["quotationspage"],
        });
      }
    });
    
    return quotes;
  } catch (error) {
    console.error("QuotationsPage scraping error:", error);
    return [];
  }
}

/**
 * Run all quote site scrapers in parallel
 */
export async function scrapeAllQuoteSites(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResultsPerSite: number = 30
): Promise<ScrapedQuote[]> {
  const results = await Promise.allSettled([
    scrapeBrainyQuote(query, searchType, maxResultsPerSite),
    scrapeGoodreadsQuotes(query, searchType, maxResultsPerSite),
    scrapeAZQuotes(query, searchType, maxResultsPerSite),
    scrapeQuoteGarden(query, searchType, maxResultsPerSite),
    scrapeQuotationsPage(query, searchType, maxResultsPerSite),
  ]);
  
  const allQuotes: ScrapedQuote[] = [];
  
  for (const result of results) {
    if (result.status === "fulfilled") {
      allQuotes.push(...result.value);
    }
  }
  
  // Deduplicate by quote text
  const seen = new Set<string>();
  const uniqueQuotes = allQuotes.filter((q) => {
    const normalized = q.quote.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  
  console.log(`Quote site scrapers found ${uniqueQuotes.length} unique quotes`);
  return uniqueQuotes;
}
