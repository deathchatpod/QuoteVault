/**
 * Wikiquote Bulk Scraper
 * Crawls Wikiquote category pages to discover quote pages,
 * then scrapes individual pages for quotes.
 */

import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "QuoteResearchBot/1.0 (Educational Research Tool)";
const TIMEOUT = 15000;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second between requests to be polite

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

/**
 * Get all page titles from a Wikiquote category
 */
async function getCategoryPages(category: string, maxPages: number = 100): Promise<string[]> {
  const pages: string[] = [];
  let continueToken: string | undefined;

  try {
    while (pages.length < maxPages) {
      const params: Record<string, string> = {
        action: "query",
        list: "categorymembers",
        cmtitle: `Category:${category}`,
        cmlimit: "50",
        cmnamespace: "0", // Main namespace only
        format: "json",
        origin: "*",
      };
      if (continueToken) {
        params.cmcontinue = continueToken;
      }

      const response = await axios.get("https://en.wikiquote.org/w/api.php", {
        params,
        timeout: TIMEOUT,
        headers: { "User-Agent": USER_AGENT },
      });

      const members = response.data.query?.categorymembers || [];
      for (const member of members) {
        if (pages.length >= maxPages) break;
        pages.push(member.title);
      }

      continueToken = response.data.continue?.cmcontinue;
      if (!continueToken) break;

      await delay(500);
    }
  } catch (error: any) {
    console.error(`[WikiquoteBulk] Error fetching category "${category}":`, error.message);
  }

  return pages;
}

/**
 * Scrape quotes from a single Wikiquote page
 */
async function scrapeWikiquotePage(pageTitle: string, maxQuotes: number = 50): Promise<ScrapedQuote[]> {
  const quotes: ScrapedQuote[] = [];

  try {
    // Fetch parsed HTML via the API
    const response = await axios.get("https://en.wikiquote.org/w/api.php", {
      params: {
        action: "parse",
        page: pageTitle,
        prop: "text",
        format: "json",
        origin: "*",
      },
      timeout: TIMEOUT,
      headers: { "User-Agent": USER_AGENT },
    });

    const html = response.data.parse?.text?.["*"];
    if (!html) return quotes;

    const $ = cheerio.load(html);

    // Remove edit links, reference markers, and navigation
    $(".mw-editsection, sup.reference, .navbox, .toc, #toc, .noprint, .mw-empty-elt").remove();

    // Wikiquote structure: quotes are usually in <ul><li> under <h2>/<h3> section headers
    // Some pages use <dl><dd> format
    let currentSection = pageTitle;

    $("h2, h3, ul > li, dl > dd").each((_, element) => {
      if (quotes.length >= maxQuotes) return false;

      const tagName = (element as any).tagName?.toLowerCase();

      if (tagName === "h2" || tagName === "h3") {
        const headingText = $(element).find(".mw-headline").text().trim();
        if (headingText && !headingText.match(/^(external links|see also|about|sourced|attributed|disputed|misattributed|references)$/i)) {
          currentSection = headingText;
        }
        return;
      }

      // Skip nested lists (usually source citations)
      if ($(element).parent().closest("li, dd").length > 0) return;

      const text = $(element).text().trim();

      // Filter: reasonable quote length, not navigation/metadata
      if (
        text.length >= 20 &&
        text.length <= 600 &&
        !text.match(/^\d{4}/) && // Not a year-starting entry
        !text.includes("Retrieved from") &&
        !text.includes("Wikiquote") &&
        !text.includes("Wikipedia") &&
        !text.includes("edit source") &&
        !text.match(/^(ISBN|ISSN|OCLC)/) &&
        !text.match(/^Category:/)
      ) {
        quotes.push({
          quote: text,
          speaker: pageTitle,
          author: pageTitle,
          work: currentSection !== pageTitle ? currentSection : null,
          sources: ["wikiquote"],
        });
      }
    });
  } catch (error: any) {
    console.error(`[WikiquoteBulk] Error scraping page "${pageTitle}":`, error.message);
  }

  return quotes;
}

/**
 * Memorial-related Wikiquote categories to crawl
 */
export const MEMORIAL_CATEGORIES = [
  "Death",
  "Grief",
  "Love",
  "Family",
  "Friendship",
  "Faith",
  "Hope",
  "Courage",
  "Virtue",
  "Compassion",
  "Wisdom",
  "Life",
  "Soul",
  "God",
  "Spirituality",
  "Philosophers",
  "Religious_leaders",
  "Poets",
  "American_poets",
  "English_poets",
  "Religious_texts",
  "Christian_texts",
  "Ancient_Greek_philosophers",
  "Roman_philosophers",
  "Stoics",
];

/**
 * Themed page titles to scrape directly (not from categories)
 */
export const MEMORIAL_PAGES = [
  // Core memorial themes
  "Death", "Grief", "Mourning", "Funeral", "Eulogy", "Bereavement",
  "Afterlife", "Heaven", "Hell", "Immortality", "Eternity", "Soul",
  "Resurrection", "Reincarnation", "Paradise",
  // Emotions
  "Love", "Loss", "Sorrow", "Tears", "Loneliness", "Longing",
  "Hope", "Comfort", "Healing", "Peace", "Acceptance", "Letting_go",
  "Gratitude", "Appreciation", "Remembrance", "Memory",
  // Family & relationships
  "Family", "Mother", "Father", "Children", "Marriage", "Friendship",
  "Brotherhood", "Devotion", "Loyalty",
  // Faith & spirituality
  "God", "Faith", "Prayer", "Blessing", "Grace", "Mercy",
  "Forgiveness", "Salvation", "Redemption", "Angels",
  "Christianity", "Islam", "Judaism", "Buddhism", "Hinduism",
  // Philosophy of life
  "Life", "Wisdom", "Time", "Old_age", "Suffering", "Pain",
  "Courage", "Strength", "Patience", "Dignity", "Honor",
  "Legacy", "Purpose", "Meaning_of_life",
  // Nature metaphors (common in memorial contexts)
  "Light", "Darkness", "Stars", "Sunset", "Seasons",
  "Garden", "Flowers", "Trees", "Ocean", "Mountains",
  // Key authors for memorial quotes
  "Emily_Dickinson", "Khalil_Gibran", "Rumi", "Maya_Angelou",
  "C._S._Lewis", "Rabindranath_Tagore", "Alfred,_Lord_Tennyson",
  "William_Shakespeare", "Walt_Whitman", "Robert_Frost",
  "Edgar_Allan_Poe", "John_Keats", "William_Wordsworth",
  "Dylan_Thomas", "W._H._Auden", "Mary_Oliver",
  "William_Butler_Yeats", "Pablo_Neruda", "Hafez",
  "Lao_Tzu", "Confucius", "Gautama_Buddha",
  "Marcus_Aurelius", "Seneca_the_Younger", "Epictetus",
  "Socrates", "Plato", "Aristotle", "Cicero",
  "Victor_Hugo", "Leo_Tolstoy", "Fyodor_Dostoevsky",
  "Charles_Dickens", "Mark_Twain", "Oscar_Wilde",
  "Mahatma_Gandhi", "Martin_Luther_King,_Jr.",
  "Mother_Teresa", "Dalai_Lama", "Thich_Nhat_Hanh",
  "Helen_Keller", "Anne_Frank", "Viktor_Frankl",
  "Elisabeth_Kübler-Ross",
];

export interface BulkScrapeProgress {
  totalPages: number;
  completedPages: number;
  totalQuotes: number;
  currentPage: string;
  errors: number;
}

/**
 * Bulk scrape Wikiquote — crawl categories and themed pages.
 * Returns quotes as they're found via a callback.
 */
export async function bulkScrapeWikiquote(
  onQuotes: (quotes: ScrapedQuote[], pageTitle: string) => Promise<void>,
  onProgress?: (progress: BulkScrapeProgress) => void,
  options: {
    maxPagesPerCategory?: number;
    maxQuotesPerPage?: number;
    includeCategories?: boolean;
  } = {}
): Promise<{ totalQuotes: number; totalPages: number; errors: number }> {
  const {
    maxPagesPerCategory = 50,
    maxQuotesPerPage = 40,
    includeCategories = true,
  } = options;

  // Collect all page titles to scrape
  const allPages = new Set<string>(MEMORIAL_PAGES);

  // Discover pages from categories
  if (includeCategories) {
    for (const category of MEMORIAL_CATEGORIES) {
      console.log(`[WikiquoteBulk] Discovering pages in Category:${category}...`);
      const categoryPages = await getCategoryPages(category, maxPagesPerCategory);
      for (const page of categoryPages) {
        allPages.add(page);
      }
      await delay(500);
    }
  }

  console.log(`[WikiquoteBulk] Total unique pages to scrape: ${allPages.size}`);

  let totalQuotes = 0;
  let completedPages = 0;
  let errors = 0;
  const pageArray = Array.from(allPages);

  for (const pageTitle of pageArray) {
    try {
      onProgress?.({
        totalPages: pageArray.length,
        completedPages,
        totalQuotes,
        currentPage: pageTitle,
        errors,
      });

      const quotes = await scrapeWikiquotePage(pageTitle, maxQuotesPerPage);

      if (quotes.length > 0) {
        await onQuotes(quotes, pageTitle);
        totalQuotes += quotes.length;
        console.log(`[WikiquoteBulk] ${pageTitle}: ${quotes.length} quotes (total: ${totalQuotes})`);
      }

      completedPages++;
      await delay(DELAY_BETWEEN_REQUESTS);
    } catch (error: any) {
      errors++;
      console.error(`[WikiquoteBulk] Error processing "${pageTitle}":`, error.message);
    }
  }

  console.log(`[WikiquoteBulk] Complete: ${totalQuotes} quotes from ${completedPages} pages (${errors} errors)`);

  return { totalQuotes, totalPages: completedPages, errors };
}
