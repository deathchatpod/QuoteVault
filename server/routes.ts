import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchFormSchema, insertQuoteSchema } from "@shared/schema";
import { searchQuotableAPI } from "./services/quotable-api";
import { searchFavQsAPI } from "./services/favqs-api";
import { searchSefariaAPI } from "./services/sefaria-api";
import { scrapeWikiquote, scrapeProjectGutenberg, scrapeWikipedia, scrapeWikidata } from "./services/web-scraper";
import { fetchBhagavadGita, fetchDhammapada, fetchHadith, fetchBuddhistSutras } from "./services/religious-texts";
import { extractQuotesWithAI, enrichQuoteData } from "./services/gemini-research";
import { verifyQuote, batchVerifyQuotes } from "./services/anthropic-verify";
import { exportQuotesToGoogleSheets } from "./services/google-sheets";

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/quotes - Get all quotes
  app.get("/api/quotes", async (req, res) => {
    try {
      const quotes = await storage.getAllQuotes();
      res.json(quotes);
    } catch (error: any) {
      console.error("Get quotes error:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // POST /api/search - Initiate multi-source quote search
  app.post("/api/search", async (req, res) => {
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

  // POST /api/quotes/verify - Verify all unverified quotes
  app.post("/api/quotes/verify", async (req, res) => {
    try {
      const allQuotes = await storage.getAllQuotes();
      const unverifiedQuotes = allQuotes.filter((q) => !q.verified);

      if (unverifiedQuotes.length === 0) {
        return res.json({ message: "No quotes to verify", totalCost: 0 });
      }

      const { results, totalCost } = await batchVerifyQuotes(
        unverifiedQuotes.map((q) => ({
          quote: q.quote,
          speaker: q.speaker,
          author: q.author,
          work: q.work,
          year: q.year,
        }))
      );

      // Update quotes with verification results
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
        });
      }

      res.json({
        verified: results.filter((r) => r.verified).length,
        total: unverifiedQuotes.length,
        totalCost,
      });
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
      const updateData = req.body;
      
      const updatedQuote = await storage.updateQuote(quoteId, updateData);
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
      
      // Parse CSV (will add the import later)
      const { parseCSV } = await import("./services/csv-processor");
      const queries = parseCSV(csvContent);
      
      if (queries.length === 0) {
        return res.status(400).json({ error: "No valid queries found in CSV" });
      }
      
      // Create bulk job record
      const { bulkJobs } = await import("@shared/schema");
      const { db } = await import("./db");
      
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
      const { bulkJobs } = await import("@shared/schema");
      const { db } = await import("./db");
      const { desc } = await import("drizzle-orm");
      
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
      const { bulkJobs } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
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

  const httpServer = createServer(app);
  return httpServer;
}

// Background bulk processing function
async function processBulkQueries(jobId: string, queries: any[]) {
  try {
    const { bulkJobs } = await import("@shared/schema");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    
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
    const { bulkJobs } = await import("@shared/schema");
    const { db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    
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
    // Stage 1: Search APIs
    await storage.updateSearchQuery(queryId, { status: "searching_apis" });

    const apiResults = await Promise.all([
      searchQuotableAPI(query, searchType, Math.floor(maxQuotes * 0.3)),
      searchFavQsAPI(query, searchType, Math.floor(maxQuotes * 0.2)),
      searchSefariaAPI(query, searchType, Math.floor(maxQuotes * 0.2)),
    ]);

    const apiQuotes = apiResults.flat();

    // Stage 2: Web Scraping
    await storage.updateSearchQuery(queryId, { status: "web_scraping" });

    const scrapingResults = await Promise.all([
      scrapeWikiquote(query, searchType, Math.floor(maxQuotes * 0.15)),
      scrapeProjectGutenberg(query, Math.floor(maxQuotes * 0.05)),
      scrapeWikipedia(query, searchType, Math.floor(maxQuotes * 0.15)),
      scrapeWikidata(query, searchType),
      fetchBhagavadGita(query, Math.floor(maxQuotes * 0.05)),
      fetchDhammapada(query, Math.floor(maxQuotes * 0.05)),
      fetchHadith(query, Math.floor(maxQuotes * 0.05)),
      fetchBuddhistSutras(query, Math.floor(maxQuotes * 0.05)),
    ]);

    const scrapedQuotes = scrapingResults.flat();

    // Combine all results
    const allRawQuotes = [...apiQuotes, ...scrapedQuotes];

    // Use AI to extract and enhance quote data
    if (allRawQuotes.length > 0) {
      const combinedText = allRawQuotes
        .map((q) => `"${q.quote}" - ${q.speaker || q.author || "Unknown"}`)
        .join("\n");

      const { quotes: aiQuotes, cost: aiCost } = await extractQuotesWithAI(
        combinedText,
        query,
        searchType,
        maxQuotes
      );
      totalCost += aiCost;

      // Stage 3: Verification and deduplication
      await storage.updateSearchQuery(queryId, { status: "verifying" });

      for (const aiQuote of aiQuotes) {
        if (quotesFound >= maxQuotes) break;

        // Check for duplicates
        const duplicate = await storage.findDuplicateQuote(aiQuote.quote);

        if (duplicate) {
          // Merge with existing quote
          await storage.mergeQuotes(duplicate, {
            speaker: aiQuote.speaker,
            author: aiQuote.author,
            work: aiQuote.work,
            year: aiQuote.year,
            type: aiQuote.type,
            reference: aiQuote.reference,
            sources: ["ai-extraction"],
          });
        } else {
          // Create new quote
          const newQuote = await storage.createQuote({
            quote: aiQuote.quote,
            speaker: aiQuote.speaker,
            author: aiQuote.author,
            work: aiQuote.work,
            year: aiQuote.year,
            type: aiQuote.type || "literature",
            reference: aiQuote.reference,
            verified: false,
            sourceConfidence: "medium",
            sources: ["ai-extraction"],
          });

          // Verify the quote
          const { result, cost } = await verifyQuote(
            newQuote.quote,
            newQuote.speaker,
            newQuote.author,
            newQuote.work,
            newQuote.year
          );
          totalCost += cost;

          await storage.updateQuote(newQuote.id, {
            verified: result.verified,
            sourceConfidence: result.sourceConfidence,
            speaker: result.corrections.speaker || newQuote.speaker,
            author: result.corrections.author || newQuote.author,
            work: result.corrections.work || newQuote.work,
            year: result.corrections.year || newQuote.year,
          });

          if (result.verified) {
            quotesVerified++;
          }
          quotesFound++;
        }
      }
    }

    // Complete the search query
    const processingTime = Date.now() - startTime;
    await storage.completeSearchQuery(
      queryId,
      quotesFound,
      quotesVerified,
      totalCost,
      processingTime
    );
  } catch (error) {
    console.error("Processing error:", error);
    await storage.updateSearchQuery(queryId, { status: "failed" });
  }
}
