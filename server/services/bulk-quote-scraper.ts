/**
 * Bulk Quote Scraper
 * Crawls popular/index pages on Goodreads and BrainyQuote
 * to harvest quotes in bulk rather than per-query.
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

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<cheerio.CheerioAPI | null> {
  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    return cheerio.load(response.data);
  } catch (error: any) {
    console.error(`[BulkScraper] Failed to fetch ${url}:`, error.message);
    return null;
  }
}

// ─── BrainyQuote Bulk ────────────────────────────────────────────

/**
 * Memorial-themed topic slugs for BrainyQuote
 */
const BRAINYQUOTE_TOPICS = [
  "death", "grief", "loss", "mourning", "bereavement",
  "afterlife", "heaven", "soul", "eternity", "immortality",
  "rest_in_peace", "angel", "paradise",
  "love", "family", "mother", "father", "children",
  "friendship", "marriage", "brother", "sister",
  "memory", "remembrance", "legacy", "tribute",
  "comfort", "healing", "hope", "peace", "solace",
  "sympathy", "compassion", "kindness", "empathy",
  "strength", "courage", "perseverance", "resilience",
  "acceptance", "faith", "god", "prayer", "blessing",
  "grace", "mercy", "forgiveness", "gratitude",
  "appreciation", "thankful", "wisdom", "time",
  "life", "suffering", "patience", "dignity",
  "goodbye", "farewell", "missing", "tears", "sorrow",
  "inspirational", "motivational",
];

/**
 * Scrape multiple pages of a BrainyQuote topic
 */
async function scrapeBrainyQuoteTopic(topic: string, maxPages: number = 3): Promise<ScrapedQuote[]> {
  const quotes: ScrapedQuote[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1
      ? `https://www.brainyquote.com/topics/${topic}-quotes`
      : `https://www.brainyquote.com/topics/${topic}-quotes_${page}`;

    const $ = await fetchPage(url);
    if (!$) break;

    let foundOnPage = 0;

    // Primary selector
    $(".clearfix").each((_, element) => {
      const quoteText = $(element).find(".b-qt, .bqQt").text().trim();
      const authorText = $(element).find(".bq-aut, .bqQuoteLink a").text().trim();

      if (quoteText && quoteText.length > 10 && quoteText.length < 1000) {
        if (!quotes.some(q => q.quote === quoteText)) {
          quotes.push({
            quote: quoteText,
            speaker: authorText || null,
            author: authorText || null,
            work: null,
            sources: ["brainyquote"],
          });
          foundOnPage++;
        }
      }
    });

    // Alternative selector
    $("a.b-qt").each((_, element) => {
      const quoteText = $(element).text().trim();
      const authorLink = $(element).closest(".m-brick").find("a.bq-aut");
      const authorText = authorLink.text().trim();

      if (quoteText && quoteText.length > 10 && quoteText.length < 1000) {
        if (!quotes.some(q => q.quote === quoteText)) {
          quotes.push({
            quote: quoteText,
            speaker: authorText || null,
            author: authorText || null,
            work: null,
            sources: ["brainyquote"],
          });
          foundOnPage++;
        }
      }
    });

    if (foundOnPage === 0) break; // No more pages
    await delay(1500); // Be polite
  }

  return quotes;
}

/**
 * Bulk scrape BrainyQuote across all memorial topics
 */
export async function bulkScrapeBrainyQuote(
  onQuotes: (quotes: ScrapedQuote[], topic: string) => Promise<void>,
  onProgress?: (completed: number, total: number, topic: string) => void,
  maxPagesPerTopic: number = 3
): Promise<{ totalQuotes: number; topics: number }> {
  let totalQuotes = 0;

  for (let i = 0; i < BRAINYQUOTE_TOPICS.length; i++) {
    const topic = BRAINYQUOTE_TOPICS[i];
    onProgress?.(i, BRAINYQUOTE_TOPICS.length, topic);

    const quotes = await scrapeBrainyQuoteTopic(topic, maxPagesPerTopic);
    if (quotes.length > 0) {
      await onQuotes(quotes, topic);
      totalQuotes += quotes.length;
      console.log(`[BulkScraper-BQ] ${topic}: ${quotes.length} quotes (total: ${totalQuotes})`);
    }

    await delay(2000); // Longer delay between topics
  }

  return { totalQuotes, topics: BRAINYQUOTE_TOPICS.length };
}

// ─── Goodreads Bulk ──────────────────────────────────────────────

/**
 * Memorial-themed tags for Goodreads quotes
 */
const GOODREADS_TAGS = [
  "death", "grief", "loss", "mourning", "bereavement",
  "afterlife", "heaven", "soul", "eternity", "immortality",
  "angel", "paradise", "rest-in-peace",
  "love", "family", "motherhood", "fatherhood", "children",
  "friendship", "marriage", "siblings",
  "memory", "remembrance", "legacy",
  "comfort", "healing", "hope", "peace",
  "sympathy", "compassion", "kindness", "empathy",
  "strength", "courage", "perseverance", "resilience",
  "faith", "god", "prayer", "blessing", "grace",
  "forgiveness", "gratitude", "thankfulness",
  "wisdom", "time", "life", "suffering",
  "patience", "dignity", "goodbye", "farewell",
  "tears", "sorrow", "heartbreak", "missing-someone",
  "inspiration", "motivation", "philosophy",
  "funeral", "condolence",
];

/**
 * Scrape multiple pages of a Goodreads tag
 */
async function scrapeGoodreadsTag(tag: string, maxPages: number = 3): Promise<ScrapedQuote[]> {
  const quotes: ScrapedQuote[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.goodreads.com/quotes/tag/${encodeURIComponent(tag)}?page=${page}`;

    const $ = await fetchPage(url);
    if (!$) break;

    let foundOnPage = 0;

    $(".quoteDetails").each((_, element) => {
      const quoteText = $(element).find(".quoteText").clone().children().remove().end().text().trim();
      const authorSpan = $(element).find(".authorOrTitle");
      const authorText = authorSpan.first().text().replace(/,\s*$/, "").trim();
      const titleSpan = $(element).find(".authorOrTitle").eq(1);
      const workText = titleSpan.text().trim() || null;

      const cleanQuote = quoteText.split("―")[0].trim().replace(/^["\u201C]|["\u201D]$/g, "").trim();

      if (cleanQuote && cleanQuote.length > 10 && cleanQuote.length < 1000) {
        if (!quotes.some(q => q.quote === cleanQuote)) {
          quotes.push({
            quote: cleanQuote,
            speaker: authorText || null,
            author: authorText || null,
            work: workText,
            sources: ["goodreads-quotes"],
          });
          foundOnPage++;
        }
      }
    });

    // Alternative selector
    $(".quote").each((_, element) => {
      const quoteText = $(element).find(".quoteText, .quoteBody").text().trim();
      const authorText = $(element).find(".quoteAuthor, .authorName").text().trim();
      const cleanQuote = quoteText.split("―")[0].trim().replace(/^["\u201C]|["\u201D]$/g, "").trim();

      if (cleanQuote && cleanQuote.length > 10 && cleanQuote.length < 1000) {
        if (!quotes.some(q => q.quote === cleanQuote)) {
          quotes.push({
            quote: cleanQuote,
            speaker: authorText || null,
            author: authorText || null,
            work: null,
            sources: ["goodreads-quotes"],
          });
          foundOnPage++;
        }
      }
    });

    if (foundOnPage === 0) break;
    await delay(2000); // Be polite to Goodreads
  }

  return quotes;
}

/**
 * Bulk scrape Goodreads across all memorial tags
 */
export async function bulkScrapeGoodreads(
  onQuotes: (quotes: ScrapedQuote[], tag: string) => Promise<void>,
  onProgress?: (completed: number, total: number, tag: string) => void,
  maxPagesPerTag: number = 3
): Promise<{ totalQuotes: number; tags: number }> {
  let totalQuotes = 0;

  for (let i = 0; i < GOODREADS_TAGS.length; i++) {
    const tag = GOODREADS_TAGS[i];
    onProgress?.(i, GOODREADS_TAGS.length, tag);

    const quotes = await scrapeGoodreadsTag(tag, maxPagesPerTag);
    if (quotes.length > 0) {
      await onQuotes(quotes, tag);
      totalQuotes += quotes.length;
      console.log(`[BulkScraper-GR] ${tag}: ${quotes.length} quotes (total: ${totalQuotes})`);
    }

    await delay(2500); // Goodreads is stricter
  }

  return { totalQuotes, tags: GOODREADS_TAGS.length };
}
