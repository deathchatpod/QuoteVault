# Design Guidelines: Quote Research & Verification Tool

## Design Approach
**Material Design System** - Optimized for data-heavy productivity applications with strong form, table, and status indicator patterns. Focus on information density, clear hierarchy, and functional efficiency over visual flourishes.

## Core Design Principles
1. **Information First** - Maximize data visibility and readability
2. **Functional Clarity** - Every element serves a clear purpose
3. **Status Transparency** - Always show processing state and costs
4. **Scannable Data** - Quick identification of quote attributes and verification status

---

## Typography

**Font Family:** Roboto (via Google Fonts CDN)
- Primary: Roboto (400, 500, 700)
- Monospace: Roboto Mono (for costs, IDs, technical data)

**Type Scale:**
- Page Titles: text-3xl font-bold
- Section Headers: text-xl font-semibold
- Card/Component Headers: text-lg font-medium
- Body Text: text-base font-normal
- Quote Text: text-lg leading-relaxed (for readability)
- Metadata/Labels: text-sm font-medium
- Technical Data (costs, IDs): text-sm font-mono
- Helper Text: text-xs

---

## Layout System

**Container Strategy:**
- Max width: max-w-7xl mx-auto
- Main padding: px-6 py-8
- Responsive: px-4 on mobile, px-6 on tablet, px-8 on desktop

**Spacing Primitives:** Tailwind units 2, 4, 6, 8, 12
- Component gaps: gap-4, gap-6
- Section spacing: py-8, py-12
- Card padding: p-6
- Form field spacing: space-y-4
- Inline spacing: px-4, mx-2

**Grid Layouts:**
- Quote cards: grid-cols-1 md:grid-cols-2 gap-6
- Stats/metrics: grid-cols-2 md:grid-cols-4 gap-4
- Form fields: Single column for clarity

---

## Component Library

### Navigation
- **Top Bar:** Fixed header with logo, app title, Google Sheets connection status
- Height: h-16
- Layout: flex items-center justify-between px-6
- No complex navigation needed (single-page application)

### Search/Input Section
- **Search Form Card:** Elevated card with shadow-lg, rounded-lg
- Large textarea for query input (min-h-32)
- Dropdown for search type (Topic/Author/Work)
- Submit button: Large, prominent (py-3 px-8)
- Max quotes slider: Shows "Up to 1,000 quotes" with range input
- Helper text below each input explaining usage

### Cost Tracking Dashboard
- **Sticky positioned** at top of results (sticky top-16)
- Metrics display in grid-cols-4:
  - Total API Cost
  - Quotes Found
  - Verified Count
  - Processing Time
- Use monospace font for numerical values
- Icon indicators from Material Icons

### Quote Results Display
- **Quote Cards:** Individual cards with rounded-lg border-2
- Card structure (p-6 space-y-4):
  - Quote text: Large, quoted formatting with quotation marks
  - Speaker/Character: font-semibold
  - Attribution row: Author, Work, Year in flex layout
  - Verification badge: Inline badge (verified/unverified)
  - Source confidence: Pills/chips (high/medium/low)
  - Type tag: Category chip (religious/literature/movie/etc.)
- Verification status icon (checkmark/warning) positioned top-right

### Data Table View (Alternative)
- Dense table for scanning large quote sets
- Columns: Quote (truncated), Speaker, Author, Work, Year, Verified, Actions
- Expandable rows to show full quote text
- Sticky header: sticky top-0

### Processing Status
- **Progress Indicator:** Linear progress bar showing batch completion
- Stage indicators: "Searching APIs → Web Scraping → Verifying → Complete"
- Current stage highlighted with animated pulse
- Estimated time remaining (if calculable)

### Forms & Inputs
- Label positioning: Above input, text-sm font-medium mb-2
- Input fields: py-2 px-4, rounded-md, border-2
- Focus state: ring-2 offset-2
- Dropdowns: Custom styled with chevron icon
- Textareas: Auto-expanding or fixed min-height

### Buttons
- Primary action: py-3 px-6 rounded-md font-semibold
- Secondary: py-2 px-4 border-2 rounded-md
- Icon buttons: p-2 rounded-full
- All buttons: transition-all duration-200
- No custom hover states on overlay buttons

### Status Indicators
- **Badges:** px-3 py-1 rounded-full text-xs font-semibold
- **Pills/Chips:** Inline-flex items-center gap-2 px-3 py-1 rounded-full
- Icons from Material Icons CDN
- Verification checkmark: Prominent, 20px size
- Warning/error icons: Same size for consistency

### Empty States
- Centered layout with icon (80px size)
- Helpful text explaining next action
- Primary CTA button centered below

### Export Section
- Google Sheets status: Connected/Disconnected indicator
- Export button: Prominent, disabled until quotes ready
- Last export timestamp display

---

## Icons
**Material Icons** (via Google Fonts CDN)
- search, verified, warning, schedule, attach_money
- cloud_upload, filter_list, expand_more, close
- check_circle, error, info, help_outline

---

## Spacing & Rhythm
- Card-to-card vertical rhythm: space-y-6
- Section breaks: pb-12 border-b
- Content breathing room: Generous padding in all cards
- Tight spacing for related items (speaker/author): space-y-2
- Loose spacing for distinct sections: space-y-8

---

## Responsive Behavior
- Mobile (base): Single column, full-width cards, simplified metrics (2-col grid)
- Tablet (md:): Two-column quote cards, 4-col metrics
- Desktop (lg:): Maintain two-column, increase max-width

---

## Key Interaction Patterns
- Batch processing: No real-time streaming, show completion state
- Deduplication indication: Subtle badge on merged quotes showing source count
- Expandable quote cards: Click to see full attribution details
- Cost updates: Numbers count up with brief animation on completion
- Skeleton loading: Placeholder cards during processing

---

## Accessibility
- Form labels always visible (no placeholders-only)
- Status communicated via text + icons
- Focus indicators on all interactive elements
- Semantic HTML (buttons, forms, tables)
- ARIA labels on icon-only buttons