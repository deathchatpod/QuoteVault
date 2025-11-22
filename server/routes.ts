import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchFormSchema, insertQuoteSchema } from "@shared/schema";
import { searchQuotableAPI } from "./services/quotable-api";
import { searchFavQsAPI } from "./services/favqs-api";
import { searchSefariaAPI } from "./services/sefaria-api";
import { scrapeWikiquote, scrapeProjectGutenberg } from "./services/web-scraper";
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

  const httpServer = createServer(app);
  return httpServer;
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
      scrapeWikiquote(query, searchType, Math.floor(maxQuotes * 0.2)),
      scrapeProjectGutenberg(query, Math.floor(maxQuotes * 0.1)),
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
