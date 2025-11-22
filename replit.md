# Quote Research & Verification Tool

## Overview

A comprehensive quote research and verification system that aggregates quotes from multiple sources (APIs, web scraping, religious texts), enriches them with AI-powered research, verifies their accuracy using advanced language models, and exports results to Google Sheets. The application provides real-time processing status, cost tracking, persistent status notifications, query history tracking with filtering, and a data-rich interface for managing quote collections.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: shadcn/ui (Radix UI primitives) with Material Design influence
- **Design Philosophy**: Information-first, data-heavy productivity application optimized for scannable content and status transparency
- **Typography**: Roboto font family (400, 500, 700) with Roboto Mono for technical data
- **Styling**: Tailwind CSS with custom theme configuration for consistent spacing, colors, and elevation patterns
- **State Management**: TanStack Query (React Query) for server state and API communication
- **Routing**: Wouter for lightweight client-side routing

**Key UI Patterns**:
- Card-based layouts for quote display with hover/active elevation states
- Table views for dense data presentation
- Real-time processing status indicators with progress tracking
- **Persistent Toast Notifications**: Bottom-right status updates during search with emoji indicators (🔍 Searching, 🌐 Web scraping, ✅ Verifying, ✅ Completed)
- **"By Query" History View**: Searchable table of all past queries with click-to-filter functionality
- Cost dashboard showing API expenses, quote counts, and processing metrics
- Tabs for switching between card, table, and query history view modes

**Design Rationale**: Material Design provides well-established patterns for data-heavy applications with strong hierarchy, clear information density, and functional clarity - ideal for a research tool that needs to display complex quote metadata, verification status, and cost information simultaneously.

### Backend Architecture

**Runtime**: Node.js with Express.js server framework

**API Design**: RESTful endpoints with the following structure:
- `GET /api/quotes` - Retrieve all stored quotes
- `POST /api/search` - Initiate asynchronous multi-source quote search
- `GET /api/queries/:id` - Poll search query status and results

**Asynchronous Processing Pattern**: 
- Search requests return immediately with a query ID
- Background processing handles multi-source data gathering
- Client polls for status updates using React Query's refetch intervals
- **Rationale**: Prevents timeout issues with long-running AI operations and web scraping; provides better UX with progress tracking

**Service Layer Architecture**:
- **API Services**: Quotable API, FavQs API, Sefaria API for structured quote data
- **Web Scrapers**: Wikiquote and Project Gutenberg for additional sources using Cheerio for HTML parsing
- **AI Services**: 
  - Google Gemini for quote extraction and enrichment from raw text
  - Anthropic Claude for quote verification and accuracy checking
- **Export Service**: Google Sheets integration for data export
- **Storage Service**: Database abstraction layer with IStorage interface

**Error Handling**: Rate limit detection and retry logic using p-retry and p-limit for concurrent request management

**Performance Optimizations** (November 2025):
- **Configuration Management**: Centralized config module (`server/config.ts`) with Zod validation ensures all environment variables are validated at startup, failing fast if required keys are missing
- **Lazy Initialization**: Pop culture adapters initialized asynchronously during server startup instead of at module load time, preventing boot crashes and improving startup resilience
- **DRY Pagination**: Reusable `fetchPaginated` utility in `server/services/api-utils.ts` eliminates ~40 lines of duplicate pagination code across API adapters (Quotable, FavQs, Sefaria)
- **Concurrent Verification**: Quote verification now processes 5 quotes in parallel using `pLimit(5)` instead of sequentially, significantly reducing total search time
- **Config Consistency**: All service modules (AI services, adapters, scrapers) now use the centralized config module instead of direct `process.env` access

### Data Storage

**Database**: PostgreSQL via Neon serverless with WebSocket support

**ORM**: Drizzle ORM with schema-first approach

**Schema Design**:

**Quotes Table**:
- Core fields: quote text, speaker, author, work, year, type
- Verification metadata: verified status, source confidence level
- Source tracking: JSON array of source identifiers
- Timestamps for creation tracking

**Search Queries Table**:
- Query tracking: search terms, type (topic/author/work), max quotes limit
- Status management: processing stages (pending → processing → completed)
- Metrics: quotes found/verified counts, API costs, processing time
- Timestamps for query lifecycle tracking

**Quote-Query Junction Table (quoteQueries)**:
- Links quotes to the queries that discovered them (many-to-many relationship)
- Enables "By Query" filtering to show quotes from specific searches
- Tracks which sources contributed to each query's results
- Supports duplicate quotes appearing in multiple search results

**Design Decisions**:
- **Duplicate Detection**: Quotes are checked for duplicates by text before insertion to prevent redundancy
- **Source Aggregation**: Multiple sources can contribute to the same quote, stored as JSON array
- **Query-Quote Linking**: Junction table allows tracking which queries discovered which quotes, enabling historical filtering
- **Cost Tracking**: API costs tracked at query level for transparency and budget management
- **Cache Management**: Query list cache is invalidated when searches start and complete to ensure UI shows latest query history

### Authentication & Authorization

**Current State**: No authentication implemented
- Application assumes trusted internal use
- Future consideration: Add session-based auth when needed for multi-user scenarios

### External Dependencies

**AI Services**:
- **Anthropic Claude API**: Quote verification, accuracy checking, and attribution correction
  - Uses environment variables: `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
  - Implements rate limit handling and retry logic
  
- **Google Gemini API**: Quote extraction from raw text and metadata enrichment
  - Uses environment variables: `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - Structured output for reliable data parsing

**Quote Data Sources**:
- **Quotable API**: Free public API for curated quotes with author/tag filtering
- **FavQs API**: Community-driven quote collection with dialogue and tagging support
- **Sefaria API**: Religious text database (Bible, Talmud, Quran) with reference tracking
- **Wikiquote**: Web scraping for comprehensive quote collections
- **Project Gutenberg**: Classic literature text extraction

**Data Export**:
- **Google Sheets API**: OAuth-based connector integration for quote export
  - Uses Replit Connectors system for credential management
  - Environment variables: `REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`, `WEB_REPL_RENEWAL`

**Database**:
- **Neon PostgreSQL**: Serverless PostgreSQL with WebSocket support for connection pooling
  - Environment variable: `DATABASE_URL`
  - Uses `@neondatabase/serverless` with Drizzle ORM

**Development Tools**:
- **Replit-specific integrations**: Vite plugins for error overlay, cartographer, and dev banner when running in Replit environment

**Design Rationale**: Multi-source approach ensures comprehensive quote coverage; AI integration provides intelligent extraction and verification that would be impossible with rule-based systems; serverless PostgreSQL reduces infrastructure complexity while maintaining relational data integrity.