-- Add pg_trgm extension for fuzzy duplicate detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add new verification columns
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS verification_status varchar(20) DEFAULT 'unverified';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS verification_sources jsonb DEFAULT '[]'::jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cross_verified_at timestamp;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Add full-text search vector (generated column)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(quote, '') || ' ' ||
      coalesce(speaker, '') || ' ' ||
      coalesce(author, '') || ' ' ||
      coalesce(work, '')
    )
  ) STORED;

-- Indexes for quotes
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_author ON quotes(author);
CREATE INDEX IF NOT EXISTS idx_quotes_speaker ON quotes(speaker);
CREATE INDEX IF NOT EXISTS idx_quotes_verified ON quotes(verified);
CREATE INDEX IF NOT EXISTS idx_quotes_type ON quotes(type);
CREATE INDEX IF NOT EXISTS idx_quotes_confidence ON quotes(confidence_score);
CREATE INDEX IF NOT EXISTS idx_quotes_verification_status ON quotes(verification_status);

-- Trigram index for fuzzy duplicate detection
CREATE INDEX IF NOT EXISTS idx_quotes_quote_trgm ON quotes USING gin(quote gin_trgm_ops);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_quotes_search_vector ON quotes USING gin(search_vector);

-- Indexes for quote_queries junction table
CREATE INDEX IF NOT EXISTS idx_quote_queries_quote_id ON quote_queries(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_queries_query_id ON quote_queries(query_id);

-- Index for search queries
CREATE INDEX IF NOT EXISTS idx_search_queries_status ON search_queries(status);

-- Backfill: mark existing AI-verified quotes as 'ai_only'
UPDATE quotes SET verification_status = 'ai_only' WHERE verified = true AND verification_status = 'unverified';
