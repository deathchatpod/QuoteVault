import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Quote type classification for pop culture and traditional sources
export const quoteTypes = [
  "literature",
  "religious",
  "speech",
  "dialogue",
  "tv",
  "movie",
  "music",
  "political-speech",
  "celebrity",
  "other"
] as const;

// Verification status values
export const verificationStatuses = [
  "unverified",
  "single_source",
  "cross_verified",
  "ai_only"
] as const;

// Source-to-religion mapping for automatic classification
export const sourceReligionMap: Record<string, string> = {
  "sefaria-api": "Judaism",
  "bhagavad-gita": "Hinduism",
  "dhammapada": "Buddhism",
  "hadith-bukhari": "Islam",
  "buddhist-sutras": "Buddhism",
};

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quote: text("quote").notNull(),
  speaker: text("speaker"),
  author: text("author"),
  work: text("work"),
  year: text("year"),
  type: varchar("type", { length: 50 }),
  verified: boolean("verified").default(false).notNull(),
  sourceConfidence: varchar("source_confidence", { length: 20 }).default("medium"),
  confidenceScore: real("confidence_score").default(0.5),
  reference: text("reference"),
  sources: jsonb("sources").$type<string[]>().default(sql`'[]'::jsonb`),
  isReligious: boolean("is_religious").default(false).notNull(),
  religion: varchar("religion", { length: 50 }),
  // New verification columns
  verificationStatus: varchar("verification_status", { length: 20 }).default("unverified"),
  verificationSources: jsonb("verification_sources").$type<any[]>().default(sql`'[]'::jsonb`),
  crossVerifiedAt: timestamp("cross_verified_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quotes_created_at").on(table.createdAt),
  index("idx_quotes_author").on(table.author),
  index("idx_quotes_speaker").on(table.speaker),
  index("idx_quotes_verified").on(table.verified),
  index("idx_quotes_type").on(table.type),
  index("idx_quotes_confidence").on(table.confidenceScore),
  index("idx_quotes_verification_status").on(table.verificationStatus),
]);

export const searchQueries = pgTable("search_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  query: text("query").notNull(),
  searchType: varchar("search_type", { length: 20 }).notNull(),
  maxQuotes: integer("max_quotes").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  quotesFound: integer("quotes_found").default(0).notNull(),
  quotesVerified: integer("quotes_verified").default(0).notNull(),
  apiCost: real("api_cost").default(0).notNull(),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_search_queries_status").on(table.status),
]);

export const bulkJobs = pgTable("bulk_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  totalQueries: integer("total_queries").notNull(),
  completedQueries: integer("completed_queries").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const quoteQueries = pgTable("quote_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  queryId: varchar("query_id").notNull().references(() => searchQueries.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quote_queries_quote_id").on(table.quoteId),
  index("idx_quote_queries_query_id").on(table.queryId),
]);

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  crossVerifiedAt: true,
});

export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertBulkJobSchema = createInsertSchema(bulkJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertQuoteQuerySchema = createInsertSchema(quoteQueries).omit({
  id: true,
  createdAt: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;

export type InsertBulkJob = z.infer<typeof insertBulkJobSchema>;
export type BulkJob = typeof bulkJobs.$inferSelect;

export type InsertQuoteQuery = z.infer<typeof insertQuoteQuerySchema>;
export type QuoteQuery = typeof quoteQueries.$inferSelect;

export const searchFormSchema = z.object({
  query: z.string().min(1, "Query is required"),
  searchType: z.enum(["topic", "author", "work"]),
  maxQuotes: z.number().min(1).max(1000),
});

export type SearchFormValues = z.infer<typeof searchFormSchema>;
