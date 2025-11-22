import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

export const bulkJobs = pgTable("bulk_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  totalQueries: integer("total_queries").notNull(),
  completedQueries: integer("completed_queries").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
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

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type SearchQuery = typeof searchQueries.$inferSelect;

export type InsertBulkJob = z.infer<typeof insertBulkJobSchema>;
export type BulkJob = typeof bulkJobs.$inferSelect;

export const searchFormSchema = z.object({
  query: z.string().min(1, "Query is required"),
  searchType: z.enum(["topic", "author", "work"]),
  maxQuotes: z.number().min(1).max(1000),
});

export type SearchFormValues = z.infer<typeof searchFormSchema>;
