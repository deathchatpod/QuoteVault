import type { Express } from "express";
import { createServer, type Server } from "http";
import pLimit from "p-limit";
import { z } from "zod";
import { storage } from "./storage";
import { searchFormSchema, insertQuoteSchema, quotes, bulkJobs, quoteQueries, searchQueries } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { searchQuotableAPI } from "./services/quotable-api";
import { searchFavQsAPI } from "./services/favqs-api";
import { searchSefariaAPI } from "./services/sefaria-api";
import { scrapeWikiquote, scrapeWikipedia, scrapeWikidata } from "./services/web-scraper";
import { fetchBhagavadGita, fetchDhammapada, fetchHadith, fetchBuddhistSutras } from "./services/religious-texts";
import { extractQuotesWithAI, enrichQuoteData } from "./services/gemini-research";
import { verifyQuote, batchVerifyQuotes } from "./services/anthropic-verify";
import { exportQuotesToGoogleSheets } from "./services/google-sheets";
import { scrapeAllQuoteSites } from "./services/quote-site-scrapers";
import { comprehensiveWebSearch } from "./services/search-engines";
import { scrapeMultipleUrls, aggregateScrapedQuotes, getRawTextForAI } from "./services/generic-web-scraper";
import { generateSearchEngineQueries } from "./services/query-generator";
import { parseCSV } from "./services/csv-processor";
import { createRateLimiter } from "./middleware/rate-limiter";
import { passiveSourceAgreement, batchCrossVerify } from "./services/cross-source-verifier";
import { bulkScrapeWikiquote } from "./services/wikiquote-bulk-scraper";
import { bulkScrapeBrainyQuote, bulkScrapeGoodreads } from "./services/bulk-quote-scraper";

// Rate limiters for expensive endpoints
const searchRateLimiter = createRateLimiter({ maxRequests: 5, windowSeconds: 60 });
const verifyRateLimiter = createRateLimiter({ maxRequests: 3, windowSeconds: 60 });
const dumpAllRateLimiter = createRateLimiter({ maxRequests: 1, windowSeconds: 300 });
const bulkScrapeRateLimiter = createRateLimiter({ maxRequests: 1, windowSeconds: 600 });

// Zod schema for quote updates - strict to reject unknown fields
const quoteUpdateSchema = z.object({
  quote: z.string().optional(),
  speaker: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  work: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  sourceConfidence: z.enum(["high", "medium", "low"]).optional(),
  reference: z.string().nullable().optional(),
  sources: z.array(z.string()).optional(),
  isReligious: z.boolean().optional(),
  religion: z.string().nullable().optional(),
  verificationStatus: z.enum(["unverified", "single_source", "cross_verified", "ai_only"]).optional(),
  verificationSources: z.array(z.any()).optional(),
}).strict();

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/quotes - Get quotes (paginated, with optional FTS)
  app.get("/api/quotes", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const search = req.query.search as string | undefined;
      const verified = req.query.verified !== undefined ? req.query.verified === "true" : undefined;
      const type = req.query.type as string | undefined;
      const verificationStatus = req.query.verificationStatus as string | undefined;
      const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence as string) : undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const filters = { page, pageSize, search, verified, type, verificationStatus, minConfidence, sortBy, sortOrder };

      // Use FTS when search is provided, fallback to paginated with ILIKE
      let result;
      if (search && search.trim().length > 0) {
        try {
          result = await storage.searchQuotesFTS(search, filters);
        } catch {
          // Fallback if FTS column doesn't exist yet
          result = await storage.getQuotesPaginated(filters);
        }
      } else {
        result = await storage.getQuotesPaginated(filters);
      }

      res.json({
        quotes: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (error: any) {
      console.error("Get quotes error:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // POST /api/search - Initiate multi-source quote search
  app.post("/api/search", searchRateLimiter, async (req, res) => {
    try {
      const validatedData = searchFormSchema.parse(req.body);
      const { query, searchType, maxQuotes } = validatedData;

      const startTime = Date.now();

      // Create search query record
      const searchQuery = await storage.createSearchQuery({
        query,
        searchType,
        maxQuotes,
        status: "processing",
        quotesFound: 0,
        quotesVerified: 0,
        apiCost: 0,
      });

      // Run search asynchronously
      processSearch(searchQuery.id, query, searchType, maxQuotes).catch(console.error);

      res.json({ queryId: searchQuery.id, status: "processing" });
    } catch (error: any) {
      console.error("Search error:", error);
      res.status(400).json({ error: error.message || "Search failed" });
    }
  });

  // GET /api/queries - Get all search queries
  app.get("/api/queries", async (req, res) => {
    try {
      const queries = await storage.getAllSearchQueries();
      res.json(queries);
    } catch (error: any) {
      console.error("Get queries error:", error);
      res.status(500).json({ error: "Failed to fetch queries" });
    }
  });

  // GET /api/queries/:id - Get specific search query
  app.get("/api/queries/:id", async (req, res) => {
    try {
      const query = await storage.getSearchQuery(req.params.id);
      if (!query) {
        return res.status(404).json({ error: "Query not found" });
      }
      res.json(query);
    } catch (error: any) {
      console.error("Get query error:", error);
      res.status(500).json({ error: "Failed to fetch query" });
    }
  });

  // GET /api/queries/:id/quotes - Get all quotes for a specific query
  app.get("/api/queries/:id/quotes", async (req, res) => {
    try {
      const quotes = await storage.getQuotesByQueryId(req.params.id);
      res.json(quotes);
    } catch (error: any) {
      console.error("Get quotes by query error:", error);
      res.status(500).json({ error: "Failed to fetch quotes for query" });
    }
  });

  // POST /api/quotes/verify - Verify quotes
  // mode: "cross_source" (default) — run Tier 2 active lookup on unverified/single-source
  // mode: "ai" — run Claude AI verification, mark as ai_only
  app.post("/api/quotes/verify", verifyRateLimiter, async (req, res) => {
    try {
      const mode = req.body?.mode || "cross_source";
      const allQuotes = await storage.getAllQuotes();
      const unverifiedQuotes = allQuotes.filter(
        (q) => !q.verified || q.verificationStatus === "unverified" || q.verificationStatus === "single_source"
      );

      if (unverifiedQuotes.length === 0) {
        return res.json({ message: "No quotes to verify", totalCost: 0 });
      }

      if (mode === "ai") {
        // Tier 3: AI verification using Claude
        const { results, totalCost } = await batchVerifyQuotes(
          unverifiedQuotes.map((q) => ({
            quote: q.quote,
            speaker: q.speaker,
            author: q.author,
            work: q.work,
            year: q.year,
          }))
        );

        for (let i = 0; i < unverifiedQuotes.length; i++) {
          const quote = unverifiedQuotes[i];
          const result = results[i];

          await storage.updateQuote(quote.id, {
            verified: result.verified,
            sourceConfidence: result.sourceConfidence,
            speaker: result.corrections.speaker || quote.speaker,
            author: result.corrections.author || quote.author,
            work: result.corrections.work || quote.work,
            year: result.corrections.year || quote.year,
            verificationStatus: result.verified ? "ai_only" : quote.verificationStatus as any,
          });
        }

        res.json({
          verified: results.filter((r) => r.verified).length,
          total: unverifiedQuotes.length,
          totalCost,
          mode: "ai",
        });
      } else {
        // Tier 2: Cross-source active lookup (default, free)
        const crossVerifyResults = await batchCrossVerify(
          unverifiedQuotes.map((q) => ({
            id: q.id,
            quote: q.quote,
            author: q.author,
            sources: Array.isArray(q.sources) ? (q.sources as string[]) : [],
          }))
        );

        let crossVerifiedCount = 0;
        for (const { id, result } of crossVerifyResults) {
          if (result.status === "cross_verified") {
            crossVerifiedCount++;
            await storage.updateQuote(id, {
              verified: true,
              verificationStatus: "cross_verified",
              verificationSources: result.matchingSources.map(s => ({
                source: s,
                matchedAt: new Date().toISOString(),
              })) as any,
              sources: result.matchingSources,
            });
          }
        }

        res.json({
          verified: crossVerifiedCount,
          total: unverifiedQuotes.length,
          totalCost: 0,
          mode: "cross_source",
        });
      }
    } catch (error: any) {
      console.error("Verify error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // POST /api/quotes/export - Export quotes to Google Sheets
  app.post("/api/quotes/export", async (req, res) => {
    try {
      const quotes = await storage.getAllQuotes();
      if (quotes.length === 0) {
        return res.status(400).json({ error: "No quotes to export" });
      }

      const spreadsheetId = await exportQuotesToGoogleSheets(quotes);
      res.json({
        success: true,
        spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      });
    } catch (error: any) {
      console.error("Export error:", error);
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  // PATCH /api/quotes/:id - Edit a quote
  app.patch("/api/quotes/:id", async (req, res) => {
    try {
      const quoteId = req.params.id;

      const parseResult = quoteUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid update data",
          details: parseResult.error.flatten().fieldErrors
        });
      }

      const updatedQuote = await storage.updateQuote(quoteId, parseResult.data);
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(updatedQuote);
    } catch (error: any) {
      console.error("Update quote error:", error);
      res.status(500).json({ error: error.message || "Failed to update quote" });
    }
  });

  // DELETE /api/quotes/:id - Delete a quote
  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      await storage.deleteQuote(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete quote error:", error);
      res.status(500).json({ error: error.message || "Failed to delete quote" });
    }
  });

  // POST /api/dump-all - Fetch ALL quotes from ALL active APIs at once
  app.post("/api/dump-all", dumpAllRateLimiter, async (req, res) => {
    try {
      const { maxPerSource = 50 } = req.body;
      const startTime = Date.now();

      // Create a search query to track this dump
      const searchQuery = await storage.createSearchQuery({
        query: "[DUMP ALL SOURCES]",
        searchType: "topic",
        maxQuotes: maxPerSource * 20, // Estimate
        status: "processing",
        quotesFound: 0,
        quotesVerified: 0,
        apiCost: 0,
      });

      // Run dump asynchronously
      dumpAllSources(searchQuery.id, maxPerSource).catch(console.error);

      res.json({ 
        queryId: searchQuery.id, 
        status: "processing",
        message: "Dumping all quotes from all active sources. This may take a few minutes." 
      });
    } catch (error: any) {
      console.error("Dump all error:", error);
      res.status(500).json({ error: error.message || "Dump all failed" });
    }
  });

  // POST /api/export-filtered - Export quotes with filters
  app.post("/api/export-filtered", async (req, res) => {
    try {
      const { verified, minConfidence, searchType, dateFrom, dateTo } = req.body;
      
      let quotes = await storage.getAllQuotes();
      
      if (verified !== undefined) {
        quotes = quotes.filter(q => q.verified === verified);
      }
      
      if (minConfidence) {
        quotes = quotes.filter(q => (q.confidenceScore ?? 0) >= minConfidence);
      }
      
      if (searchType) {
        quotes = quotes.filter(q => q.type === searchType);
      }
      
      if (dateFrom) {
        quotes = quotes.filter(q => new Date(q.createdAt) >= new Date(dateFrom));
      }
      
      if (dateTo) {
        quotes = quotes.filter(q => new Date(q.createdAt) <= new Date(dateTo));
      }
      
      const url = await exportQuotesToGoogleSheets(quotes);
      res.json({ url });
    } catch (error: any) {
      console.error("Filtered export error:", error);
      res.status(500).json({ error: error.message || "Filtered export failed" });
    }
  });

  // POST /api/bulk-upload - Upload CSV for bulk processing
  app.post("/api/bulk-upload", async (req, res) => {
    try {
      const { csvContent, filename } = req.body;
      
      if (!csvContent || !filename) {
        return res.status(400).json({ error: "CSV content and filename are required" });
      }
      
      const queries = parseCSV(csvContent);

      if (queries.length === 0) {
        return res.status(400).json({ error: "No valid queries found in CSV" });
      }

      const [bulkJob] = await db.insert(bulkJobs).values({
        filename,
        totalQueries: queries.length,
        completedQueries: 0,
        status: "processing",
      }).returning();
      
      // Process queries sequentially in background
      processBulkQueries(bulkJob.id, queries).catch(console.error);
      
      res.json({ jobId: bulkJob.id, totalQueries: queries.length });
    } catch (error: any) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ error: error.message || "Bulk upload failed" });
    }
  });

  // GET /api/bulk-jobs - Get all bulk jobs
  app.get("/api/bulk-jobs", async (req, res) => {
    try {
      const jobs = await db.select().from(bulkJobs).orderBy(desc(bulkJobs.createdAt));
      
      res.json(jobs);
    } catch (error) {
      console.error("[api/bulk-jobs] Error:", error);
      res.status(500).json({ error: "Failed to fetch bulk jobs" });
    }
  });

  // GET /api/bulk-jobs/:id - Get bulk job status
  app.get("/api/bulk-jobs/:id", async (req, res) => {
    try {
      const [job] = await db.select().from(bulkJobs).where(eq(bulkJobs.id, req.params.id));
      
      if (!job) {
        return res.status(404).json({ error: "Bulk job not found" });
      }
      
      res.json(job);
    } catch (error: any) {
      console.error("Get bulk job error:", error);
      res.status(500).json({ error: "Failed to fetch bulk job" });
    }
  });

  // POST /api/bulk-scrape - Launch bulk scraping job (Wikiquote, BrainyQuote, Goodreads)
  app.post("/api/bulk-scrape", bulkScrapeRateLimiter, async (req, res) => {
    try {
      const { sources = ["wikiquote", "brainyquote", "goodreads"] } = req.body;

      const searchQuery = await storage.createSearchQuery({
        query: `[BULK SCRAPE: ${sources.join(", ")}]`,
        searchType: "topic",
        maxQuotes: 10000,
        status: "processing",
        quotesFound: 0,
        quotesVerified: 0,
        apiCost: 0,
      });

      // Run in background
      runBulkScrape(searchQuery.id, sources).catch(console.error);

      res.json({
        queryId: searchQuery.id,
        status: "processing",
        sources,
        message: "Bulk scraping started. This may take 10-30 minutes depending on sources.",
      });
    } catch (error: any) {
      console.error("Bulk scrape error:", error);
      res.status(500).json({ error: error.message || "Failed to start bulk scrape" });
    }
  });

  // GET /api/bulk-scrape/status/:id - Get bulk scrape progress
  app.get("/api/bulk-scrape/status/:id", async (req, res) => {
    try {
      const query = await storage.getSearchQuery(req.params.id);
      if (!query) {
        return res.status(404).json({ error: "Scrape job not found" });
      }
      res.json(query);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get scrape status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background bulk processing function
async function processBulkQueries(jobId: string, queries: any[]) {
  try {
    for (let i = 0; i < queries.length; i++) {
      const { query, searchType, maxQuotes } = queries[i];
      
      // Create and process search query
      const searchQuery = await storage.createSearchQuery({
        query,
        searchType,
        maxQuotes,
        status: "processing",
        quotesFound: 0,
        quotesVerified: 0,
        apiCost: 0,
      });
      
      await processSearch(searchQuery.id, query, searchType, maxQuotes);
      
      // Update bulk job progress
      await db.update(bulkJobs)
        .set({ completedQueries: i + 1 })
        .where(eq(bulkJobs.id, jobId));
    }
    
    // Mark bulk job as completed
    await db.update(bulkJobs)
      .set({ 
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(bulkJobs.id, jobId));
      
  } catch (error) {
    console.error("Bulk processing error:", error);
    await db.update(bulkJobs)
      .set({ status: "failed" })
      .where(eq(bulkJobs.id, jobId));
  }
}

// Background processing function
async function processSearch(
  queryId: string,
  query: string,
  searchType: "topic" | "author" | "work",
  maxQuotes: number
) {
  const startTime = Date.now();
  let totalCost = 0;
  let quotesFound = 0;
  let quotesVerified = 0;

  try {
    // Stage 1: Search APIs (traditional + pop culture)
    await storage.updateSearchQuery(queryId, { status: "searching_apis" });

    const { searchPopCultureQuotes } = await import("./services/pop-culture-service");
    const popCulturePromise = searchPopCultureQuotes(query, searchType, Math.min(maxQuotes, 10));

    // Fetch from pop culture adapters
    const popCultureResults = await popCulturePromise;
    totalCost += popCultureResults.totalCost;

    // Fetch from traditional APIs
    const [quotableQuotes, favqsQuotes, sefariaQuotes] = await Promise.all([
      searchQuotableAPI(query, searchType, Math.floor(maxQuotes * 0.3)),
      searchFavQsAPI(query, searchType, Math.floor(maxQuotes * 0.2)),
      searchSefariaAPI(query, searchType, Math.floor(maxQuotes * 0.2)),
    ]);

    // Combine all API quotes
    const apiQuotes = [
      ...popCultureResults.quotes,
      ...quotableQuotes,
      ...favqsQuotes,
      ...sefariaQuotes,
    ];

    // Stage 2: Web Scraping (Expanded)
    await storage.updateSearchQuery(queryId, { status: "web_scraping" });
    console.log(`[Search] Stage 2: Starting expanded web scraping for "${query}"`);

    // Run original scrapers
    const originalScrapingPromise = Promise.all([
      scrapeWikiquote(query, searchType, Math.floor(maxQuotes * 0.1)),
      // scrapeProjectGutenberg removed - creates fake entries like "Available in Project Gutenberg: Title"
      scrapeWikipedia(query, searchType, Math.floor(maxQuotes * 0.1)),
      scrapeWikidata(query, searchType),
      fetchBhagavadGita(query, Math.floor(maxQuotes * 0.03)),
      fetchDhammapada(query, Math.floor(maxQuotes * 0.03)),
      fetchHadith(query, Math.floor(maxQuotes * 0.03)),
      fetchBuddhistSutras(query, Math.floor(maxQuotes * 0.03)),
    ]);

    // Run new quote site scrapers (BrainyQuote, Goodreads, AZQuotes, etc.)
    const quoteSitesPromise = scrapeAllQuoteSites(query, searchType, Math.floor(maxQuotes * 0.15));

    // Run search engine integration (Google + Bing)
    const searchEnginePromise = comprehensiveWebSearch(query, searchType, 20);

    // Wait for all scraping to complete
    const [originalResults, quoteSiteResults, searchEngineResults] = await Promise.all([
      originalScrapingPromise,
      quoteSitesPromise,
      searchEnginePromise,
    ]);

    console.log(`[Search] Original scrapers found ${originalResults.flat().length} quotes`);
    console.log(`[Search] Quote sites found ${quoteSiteResults.length} quotes`);
    console.log(`[Search] Search engines found ${searchEngineResults.length} URLs to scrape`);

    // Scrape URLs from search engine results
    let genericScrapedQuotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; type: string; reference: string | null; sources: string[] }> = [];
    let scrapedRawText = "";
    
    if (searchEngineResults.length > 0) {
      const scrapedPages = await scrapeMultipleUrls(searchEngineResults, 15, 3);
      genericScrapedQuotes = aggregateScrapedQuotes(scrapedPages, searchType);
      // Get raw text for AI processing of pages that had content but few structured quotes
      scrapedRawText = getRawTextForAI(scrapedPages, 30000);
      console.log(`[Search] Generic scraper extracted ${genericScrapedQuotes.length} quotes and ${scrapedRawText.length} chars of raw text`);
    }

    // Combine all scraped quotes
    const scrapedQuotes = [
      ...originalResults.flat(),
      ...quoteSiteResults.map(q => ({
        quote: q.quote,
        speaker: q.speaker,
        author: q.author,
        work: q.work,
        type: searchType === "author" ? "attributed" : "general",
        reference: null,
        sources: q.sources,
      })),
      ...genericScrapedQuotes.map(q => ({
        quote: q.quote,
        speaker: q.speaker,
        author: q.author,
        work: q.work,
        type: q.type,
        reference: q.reference,
        sources: q.sources,
      })),
    ];
    
    console.log(`[Search] Total scraped quotes: ${scrapedQuotes.length}`);

    // All known adapter sources that should skip AI extraction
    const structuredSources = [
      // Working adapters
      'lyrics-ovh', 'api-ninjas-quotes',
      // Wisdom/philosophy adapters
      'typefit', 'zenquotes', 'affirmations-dev', 'philosophy-rest', 'philosophy-api', 'philosophers-api', 'stands4-phrases',
      // Existing adapters
      'advice-slip', 'motivational-spark', 'indian-quotes', 'recite', 'poetrydb',
      // New free API adapters
      'they-said-so', 'forismatic', 'stoic-quotes', 'got-quotes', 'breaking-bad', 'lucifer-quotes',
      // Core APIs
      'quotable', 'favqs', 'sefaria',
      // Quote site scrapers (structured data)
      'brainyquote', 'goodreads-quotes', 'azquotes', 'quotegarden', 'quotationspage',
    ];
    
    // Separate structured pop culture quotes from raw quotes needing AI processing
    const structuredQuotes = apiQuotes.filter(q => {
      const sources = q.sources as string[] | undefined;
      return sources?.some(s => structuredSources.includes(s));
    });
    
    const rawQuotes = [
      ...apiQuotes.filter(q => !structuredQuotes.includes(q)),
      ...scrapedQuotes
    ];

    // Use AI to extract quotes from raw text (unstructured sources only)
    let aiExtractedQuotes: any[] = [];
    if (rawQuotes.length > 0 || scrapedRawText.length > 0) {
      const structuredRawText = rawQuotes
        .map((q) => `"${q.quote}" - ${q.speaker || q.author || "Unknown"}`)
        .join("\n");

      const combinedText = scrapedRawText.length > 0
        ? `${structuredRawText}\n\n--- Additional Web Sources ---\n${scrapedRawText}`
        : structuredRawText;

      console.log(`[Search] Processing ${combinedText.length} chars of text with AI extraction`);

      const { quotes: aiQuotes, cost: aiCost } = await extractQuotesWithAI(
        combinedText,
        query,
        searchType,
        maxQuotes
      );
      totalCost += aiCost;
      aiExtractedQuotes = aiQuotes.map(q => ({
        ...q,
        sources: ["ai-extraction"],
        type: q.type || "literature",
        verified: false,
        sourceConfidence: "medium",
      }));
    }

    // Stage 3: Cross-source verification
    await storage.updateSearchQuery(queryId, { status: "verifying" });

    // Combine ALL quotes into a single pool for cross-source analysis
    const allCollectedQuotes: Array<{
      quote: string;
      speaker: string | null;
      author: string | null;
      work: string | null;
      year: string | null;
      type: string | null;
      reference: string | null;
      sources: string[];
      isReligious: boolean;
      religion: string | null;
    }> = [
      ...structuredQuotes.map(q => ({
        quote: q.quote as string,
        speaker: (q as any).speaker || null,
        author: (q as any).author || null,
        work: (q as any).work || null,
        year: (q as any).year || null,
        type: (q as any).type || null,
        reference: (q as any).reference || null,
        sources: (Array.isArray(q.sources) ? q.sources : []) as string[],
        isReligious: (q as any).isReligious || false,
        religion: (q as any).religion || null,
      })),
      ...aiExtractedQuotes.map((q: any) => ({
        quote: q.quote as string,
        speaker: q.speaker || null,
        author: q.author || null,
        work: q.work || null,
        year: q.year || null,
        type: q.type || null,
        reference: q.reference || null,
        sources: (Array.isArray(q.sources) ? q.sources : []) as string[],
        isReligious: false,
        religion: null as string | null,
      })),
    ];

    console.log(`[Search] Running cross-source verification on ${allCollectedQuotes.length} quotes`);

    // Cluster quotes by similarity and determine verification status
    const clusters = passiveSourceAgreement(allCollectedQuotes);
    console.log(`[Search] Found ${clusters.length} unique quote clusters`);

    // Store quotes from clusters
    for (const cluster of clusters) {
      if (quotesFound >= maxQuotes) break;

      const best = cluster.bestQuote;
      const mergedSources = cluster.distinctSources;

      // Check for duplicates in DB
      const duplicate = await storage.findDuplicateQuote(best.quote);

      if (duplicate) {
        // Merge with existing
        await storage.mergeQuotes(duplicate, {
          speaker: best.speaker,
          author: best.author,
          work: best.work,
          year: best.year,
          type: best.type,
          reference: best.reference,
          sources: mergedSources,
          verificationStatus: cluster.verificationStatus,
          verificationSources: mergedSources.map(s => ({ source: s, matchedAt: new Date().toISOString() })) as any,
        });
        await storage.linkQuoteToQuery(duplicate.id, queryId);
        if (cluster.verificationStatus === "cross_verified") quotesVerified++;
      } else {
        const newQuote = await storage.createQuote({
          quote: best.quote,
          speaker: best.speaker,
          author: best.author,
          work: best.work,
          year: best.year,
          type: best.type || "literature",
          reference: best.reference,
          verified: cluster.verificationStatus === "cross_verified",
          sourceConfidence: cluster.verificationStatus === "cross_verified" ? "high" : "medium",
          sources: mergedSources,
          isReligious: (best as any).isReligious || false,
          religion: (best as any).religion || null,
          verificationStatus: cluster.verificationStatus,
          verificationSources: mergedSources.map(s => ({ source: s, matchedAt: new Date().toISOString() })) as any,
        });

        await storage.linkQuoteToQuery(newQuote.id, queryId);
        quotesFound++;
        if (cluster.verificationStatus === "cross_verified") quotesVerified++;
      }
    }

    // Complete the search query
    const processingTime = Date.now() - startTime;
    console.log(`[Search] Completing query ${queryId}: found=${quotesFound}, verified=${quotesVerified}, cost=$${totalCost.toFixed(4)}, time=${processingTime}ms`);
    await storage.completeSearchQuery(
      queryId,
      quotesFound,
      quotesVerified,
      totalCost,
      processingTime
    );
    console.log(`[Search] Query ${queryId} completed successfully`);
  } catch (error) {
    console.error("Processing error:", error);
    await storage.updateSearchQuery(queryId, { status: "failed" });
  }
}

// Helper to deduplicate, store, and link a batch of quotes
async function storeQuoteBatch(
  quotesList: any[],
  queryId: string,
  sourceName: string
): Promise<number> {
  let stored = 0;
  for (const quote of quotesList) {
    try {
      const duplicate = await storage.findDuplicateQuote(quote.quote);
      if (!duplicate) {
        const created = await storage.createQuote(quote);
        await storage.linkQuoteToQuery(created.id, queryId);
        stored++;
        console.log(`[${sourceName}] Created: "${created.quote.substring(0, 40)}..." from ${created.sources}`);
      } else {
        await storage.linkQuoteToQuery(duplicate.id, queryId);
      }
    } catch (err: any) {
      console.error(`[${sourceName}] Error processing quote:`, err.message);
    }
  }
  return stored;
}

// Background function to dump ALL quotes from ALL sources
async function dumpAllSources(queryId: string, maxPerSource: number) {
  const startTime = Date.now();
  let totalCost = 0;
  let quotesFound = 0;

  try {
    console.log(`[DumpAll] Starting dump of all sources, max ${maxPerSource} per source`);
    await storage.updateSearchQuery(queryId, { status: "searching_apis" });

    // Import the service and registry
    const { quoteSourceRegistry } = await import("./services/quote-source-adapter");
    const { getRandomPopCultureQuotes } = await import("./services/pop-culture-service");

    // Get random quotes from all pop culture adapters
    console.log(`[DumpAll] Fetching from pop culture adapters...`);
    const popCultureResult = await getRandomPopCultureQuotes(maxPerSource * 10);
    totalCost += popCultureResult.totalCost;

    // Process pop culture quotes
    quotesFound += await storeQuoteBatch(popCultureResult.quotes, queryId, "DumpAll-PopCulture");

    // Also fetch from traditional APIs
    await storage.updateSearchQuery(queryId, { status: "web_scraping" });
    console.log(`[DumpAll] Fetching from traditional APIs...`);

    // Quotable API - get random quotes
    try {
      const quotableQuotes = await searchQuotableAPI("life", "topic", maxPerSource);
      quotesFound += await storeQuoteBatch(quotableQuotes, queryId, "DumpAll-Quotable");
      console.log(`[DumpAll] Quotable: processed ${quotableQuotes.length} quotes`);
    } catch (err: any) {
      console.error(`[DumpAll] Quotable error:`, err.message);
    }

    // FavQs API
    try {
      const favqsQuotes = await searchFavQsAPI("inspiration", "topic", maxPerSource);
      quotesFound += await storeQuoteBatch(favqsQuotes, queryId, "DumpAll-FavQs");
      console.log(`[DumpAll] FavQs: processed ${favqsQuotes.length} quotes`);
    } catch (err: any) {
      console.error(`[DumpAll] FavQs error:`, err.message);
    }

    // Sefaria API
    try {
      const sefariaQuotes = await searchSefariaAPI("wisdom", "topic", maxPerSource);
      quotesFound += await storeQuoteBatch(sefariaQuotes, queryId, "DumpAll-Sefaria");
      console.log(`[DumpAll] Sefaria: processed ${sefariaQuotes.length} quotes`);
    } catch (err: any) {
      console.error(`[DumpAll] Sefaria error:`, err.message);
    }

    // Complete the dump query
    const processingTime = Date.now() - startTime;
    console.log(`[DumpAll] Completed: found=${quotesFound}, cost=$${totalCost.toFixed(4)}, time=${processingTime}ms`);
    
    await storage.completeSearchQuery(
      queryId,
      quotesFound,
      0, // No verification in dump mode
      totalCost,
      processingTime
    );
    
    console.log(`[DumpAll] Query ${queryId} completed successfully`);
  } catch (error) {
    console.error("[DumpAll] Error:", error);
    await storage.updateSearchQuery(queryId, { status: "failed" });
  }
}

// Background bulk scrape function
async function runBulkScrape(queryId: string, sources: string[]) {
  const startTime = Date.now();
  let totalQuotesStored = 0;

  try {
    await storage.updateSearchQuery(queryId, { status: "web_scraping" });

    // Shared callback to store scraped quotes with deduplication
    const storeScrapedQuotes = async (quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>, label: string) => {
      for (const q of quotes) {
        try {
          const duplicate = await storage.findDuplicateQuote(q.quote);
          if (!duplicate) {
            const created = await storage.createQuote({
              quote: q.quote,
              speaker: q.speaker,
              author: q.author,
              work: q.work,
              year: null,
              type: "literature",
              reference: null,
              verified: false,
              sourceConfidence: "medium",
              sources: q.sources,
              isReligious: false,
              religion: null,
              verificationStatus: "single_source",
            });
            await storage.linkQuoteToQuery(created.id, queryId);
            totalQuotesStored++;
          } else {
            // Merge sources
            const existingSources = Array.isArray(duplicate.sources) ? (duplicate.sources as string[]) : [];
            const newSources = Array.from(new Set([...existingSources, ...q.sources]));
            if (newSources.length > existingSources.length) {
              await storage.mergeQuotes(duplicate, {
                sources: newSources,
                speaker: q.speaker || duplicate.speaker,
                author: q.author || duplicate.author,
                work: q.work || duplicate.work,
              });
            }
            await storage.linkQuoteToQuery(duplicate.id, queryId);
          }
        } catch (err: any) {
          // Skip individual quote errors
        }
      }
    };

    // Run each source
    if (sources.includes("wikiquote")) {
      console.log(`[BulkScrape] Starting Wikiquote bulk scrape...`);
      const result = await bulkScrapeWikiquote(
        async (quotes, pageTitle) => storeScrapedQuotes(quotes, `Wikiquote:${pageTitle}`),
        (progress) => {
          console.log(`[BulkScrape] Wikiquote: ${progress.completedPages}/${progress.totalPages} pages, ${progress.totalQuotes} quotes found, current: ${progress.currentPage}`);
        },
        { maxPagesPerCategory: 30, maxQuotesPerPage: 30, includeCategories: true }
      );
      console.log(`[BulkScrape] Wikiquote done: ${result.totalQuotes} quotes from ${result.totalPages} pages`);
    }

    if (sources.includes("brainyquote")) {
      console.log(`[BulkScrape] Starting BrainyQuote bulk scrape...`);
      const result = await bulkScrapeBrainyQuote(
        async (quotes, topic) => storeScrapedQuotes(quotes, `BrainyQuote:${topic}`),
        (completed, total, topic) => {
          console.log(`[BulkScrape] BrainyQuote: ${completed}/${total} topics, current: ${topic}`);
        },
        2 // 2 pages per topic
      );
      console.log(`[BulkScrape] BrainyQuote done: ${result.totalQuotes} quotes from ${result.topics} topics`);
    }

    if (sources.includes("goodreads")) {
      console.log(`[BulkScrape] Starting Goodreads bulk scrape...`);
      const result = await bulkScrapeGoodreads(
        async (quotes, tag) => storeScrapedQuotes(quotes, `Goodreads:${tag}`),
        (completed, total, tag) => {
          console.log(`[BulkScrape] Goodreads: ${completed}/${total} tags, current: ${tag}`);
        },
        2 // 2 pages per tag
      );
      console.log(`[BulkScrape] Goodreads done: ${result.totalQuotes} quotes from ${result.tags} tags`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[BulkScrape] All done: ${totalQuotesStored} new quotes stored in ${Math.round(processingTime / 1000)}s`);

    await storage.completeSearchQuery(queryId, totalQuotesStored, 0, 0, processingTime);
  } catch (error) {
    console.error("[BulkScrape] Error:", error);
    await storage.updateSearchQuery(queryId, { status: "failed" });
  }
}
