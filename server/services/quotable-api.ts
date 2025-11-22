import { fetchPaginated } from "./api-utils";

interface QuotableQuote {
  _id: string;
  content: string;
  author: string;
  tags: string[];
  authorSlug: string;
  length: number;
  dateAdded: string;
  dateModified: string;
}

interface QuotableResponse {
  results: QuotableQuote[];
  totalPages: number;
}

export async function searchQuotableAPI(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 100
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const limit = Math.min(50, maxResults);
    
    const rawQuotes = await fetchPaginated<QuotableQuote>({
      baseUrl: "https://api.quotable.io/quotes",
      maxPages: Math.ceil(Math.min(maxResults, 500) / limit),
      buildUrl: (page) => {
        const params = new URLSearchParams({
          limit: String(limit),
          page: String(page),
        });

        if (searchType === "author") {
          params.set("author", query);
        } else if (searchType === "topic") {
          params.set("tags", query.toLowerCase());
        }

        return `https://api.quotable.io/quotes?${params.toString()}`;
      },
      extractResults: (data: QuotableResponse) => data.results || [],
      hasMorePages: (data: QuotableResponse, page) => data.totalPages > page,
      timeout: 10000,
    });

    // Transform and limit results
    return rawQuotes.slice(0, maxResults).map((q) => ({
      quote: q.content,
      speaker: q.author,
      author: q.author,
      work: null,
      sources: ["quotable-api"],
    }));
  } catch (error) {
    console.error("Quotable API error:", error);
    return [];
  }
}
