import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Use vi.hoisted so the mock object is available when vi.mock factories run
const mockStorage = vi.hoisted(() => ({
  getQuotesPaginated: vi.fn(),
  searchQuotesFTS: vi.fn(),
  getQuote: vi.fn(),
  getAllQuotes: vi.fn(),
  updateQuote: vi.fn(),
  deleteQuote: vi.fn(),
  createSearchQuery: vi.fn(),
  getAllSearchQueries: vi.fn(),
  getSearchQuery: vi.fn(),
  getQuotesByQueryId: vi.fn(),
  findDuplicateQuote: vi.fn(),
  createQuote: vi.fn(),
  linkQuoteToQuery: vi.fn(),
  mergeQuotes: vi.fn(),
  completeSearchQuery: vi.fn(),
}));

// Mock all external services before importing routes
vi.mock("../storage", () => ({ storage: mockStorage }));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../services/quotable-api", () => ({ searchQuotableAPI: vi.fn().mockResolvedValue([]) }));
vi.mock("../services/favqs-api", () => ({ searchFavQsAPI: vi.fn().mockResolvedValue([]) }));
vi.mock("../services/sefaria-api", () => ({ searchSefariaAPI: vi.fn().mockResolvedValue([]) }));
vi.mock("../services/web-scraper", () => ({
  scrapeWikiquote: vi.fn().mockResolvedValue([]),
  scrapeWikipedia: vi.fn().mockResolvedValue([]),
  scrapeWikidata: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/religious-texts", () => ({
  fetchBhagavadGita: vi.fn().mockResolvedValue([]),
  fetchDhammapada: vi.fn().mockResolvedValue([]),
  fetchHadith: vi.fn().mockResolvedValue([]),
  fetchBuddhistSutras: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/gemini-research", () => ({
  extractQuotesWithAI: vi.fn().mockResolvedValue({ quotes: [], cost: 0 }),
  enrichQuoteData: vi.fn(),
}));
vi.mock("../services/anthropic-verify", () => ({
  verifyQuote: vi.fn(),
  batchVerifyQuotes: vi.fn().mockResolvedValue({ results: [], totalCost: 0 }),
}));
vi.mock("../services/google-sheets", () => ({
  exportQuotesToGoogleSheets: vi.fn().mockResolvedValue("sheet-id-123"),
}));
vi.mock("../services/quote-site-scrapers", () => ({
  scrapeAllQuoteSites: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/search-engines", () => ({
  comprehensiveWebSearch: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/generic-web-scraper", () => ({
  scrapeMultipleUrls: vi.fn().mockResolvedValue([]),
  aggregateScrapedQuotes: vi.fn().mockReturnValue([]),
  getRawTextForAI: vi.fn().mockReturnValue(""),
}));
vi.mock("../services/query-generator", () => ({
  generateSearchEngineQueries: vi.fn().mockReturnValue([]),
}));
vi.mock("../services/csv-processor", () => ({
  parseCSV: vi.fn().mockReturnValue([]),
}));
vi.mock("../services/cross-source-verifier", () => ({
  passiveSourceAgreement: vi.fn().mockReturnValue([]),
  batchCrossVerify: vi.fn().mockResolvedValue([]),
}));
vi.mock("@shared/schema", () => ({
  searchFormSchema: {
    parse: (data: any) => data,
  },
  insertQuoteSchema: {},
  quotes: {},
  bulkJobs: {},
  quoteQueries: {},
  searchQueries: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
}));

// Import and register routes
import { registerRoutes } from "../routes";

let app: express.Express;

beforeEach(async () => {
  vi.clearAllMocks();
  app = express();
  app.use(express.json());

  // Register routes
  await registerRoutes(app);
});

describe("GET /api/quotes", () => {
  it("returns paginated quotes with default params", async () => {
    mockStorage.getQuotesPaginated.mockResolvedValue({
      data: [{ id: "1", quote: "Test quote", author: "Author" }],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    const res = await request(app).get("/api/quotes");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("quotes");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("pageSize");
    expect(res.body.quotes).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it("passes pagination params to storage", async () => {
    mockStorage.getQuotesPaginated.mockResolvedValue({
      data: [],
      total: 0,
      page: 2,
      pageSize: 10,
    });

    await request(app).get("/api/quotes?page=2&pageSize=10");

    expect(mockStorage.getQuotesPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
      })
    );
  });

  it("uses FTS when search param provided", async () => {
    mockStorage.searchQuotesFTS.mockResolvedValue({
      data: [{ id: "1", quote: "Love is all you need" }],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    const res = await request(app).get("/api/quotes?search=love");

    expect(res.status).toBe(200);
    expect(mockStorage.searchQuotesFTS).toHaveBeenCalledWith(
      "love",
      expect.objectContaining({ search: "love" })
    );
  });

  it("falls back to paginated when FTS fails", async () => {
    mockStorage.searchQuotesFTS.mockRejectedValue(new Error("FTS not available"));
    mockStorage.getQuotesPaginated.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    const res = await request(app).get("/api/quotes?search=test");

    expect(res.status).toBe(200);
    expect(mockStorage.getQuotesPaginated).toHaveBeenCalled();
  });

  it("passes filter params correctly", async () => {
    mockStorage.getQuotesPaginated.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    await request(app).get(
      "/api/quotes?verified=true&type=literature&verificationStatus=cross_verified&minConfidence=0.5"
    );

    expect(mockStorage.getQuotesPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        verified: true,
        type: "literature",
        verificationStatus: "cross_verified",
        minConfidence: 0.5,
      })
    );
  });
});

describe("PATCH /api/quotes/:id", () => {
  it("updates a quote with valid data", async () => {
    const updatedQuote = { id: "1", quote: "Updated quote", author: "Author" };
    mockStorage.updateQuote.mockResolvedValue(updatedQuote);

    const res = await request(app)
      .patch("/api/quotes/1")
      .send({ quote: "Updated quote" });

    expect(res.status).toBe(200);
    expect(res.body.quote).toBe("Updated quote");
  });

  it("rejects unknown fields with strict validation", async () => {
    const res = await request(app)
      .patch("/api/quotes/1")
      .send({ quote: "Updated", unknownField: "bad" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid update data");
  });

  it("returns 404 for non-existent quote", async () => {
    mockStorage.updateQuote.mockResolvedValue(undefined);

    const res = await request(app)
      .patch("/api/quotes/nonexistent")
      .send({ quote: "Updated" });

    expect(res.status).toBe(404);
  });

  it("validates verificationStatus enum", async () => {
    const res = await request(app)
      .patch("/api/quotes/1")
      .send({ verificationStatus: "invalid_status" });

    expect(res.status).toBe(400);
  });

  it("validates sourceConfidence enum", async () => {
    const res = await request(app)
      .patch("/api/quotes/1")
      .send({ sourceConfidence: "very_high" });

    expect(res.status).toBe(400);
  });

  it("accepts valid verificationStatus values", async () => {
    mockStorage.updateQuote.mockResolvedValue({ id: "1", verificationStatus: "cross_verified" });

    const res = await request(app)
      .patch("/api/quotes/1")
      .send({ verificationStatus: "cross_verified" });

    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/quotes/:id", () => {
  it("deletes a quote", async () => {
    mockStorage.deleteQuote.mockResolvedValue(undefined);

    const res = await request(app).delete("/api/quotes/1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });
});

describe("Rate limiting", () => {
  it("allows requests within rate limit", async () => {
    mockStorage.getQuotesPaginated.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    // GET /api/quotes is not rate limited
    const res = await request(app).get("/api/quotes");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/queries", () => {
  it("returns all search queries", async () => {
    mockStorage.getAllSearchQueries.mockResolvedValue([
      { id: "1", query: "love", searchType: "topic", status: "completed" },
    ]);

    const res = await request(app).get("/api/queries");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].query).toBe("love");
  });
});

describe("GET /api/queries/:id", () => {
  it("returns a specific query", async () => {
    mockStorage.getSearchQuery.mockResolvedValue({
      id: "1",
      query: "love",
      status: "completed",
    });

    const res = await request(app).get("/api/queries/1");

    expect(res.status).toBe(200);
    expect(res.body.query).toBe("love");
  });

  it("returns 404 for non-existent query", async () => {
    mockStorage.getSearchQuery.mockResolvedValue(undefined);

    const res = await request(app).get("/api/queries/nonexistent");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/queries/:id/quotes", () => {
  it("returns quotes for a specific query", async () => {
    mockStorage.getQuotesByQueryId.mockResolvedValue([
      { id: "q1", quote: "Test quote" },
    ]);

    const res = await request(app).get("/api/queries/1/quotes");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
