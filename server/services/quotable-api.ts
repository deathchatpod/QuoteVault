import axios from "axios";

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

export async function searchQuotableAPI(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 100
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }> = [];
    let page = 1;
    const limit = Math.min(maxResults, 150);

    while (quotes.length < maxResults && page <= 10) {
      const params: any = { limit: Math.min(50, limit), page };

      if (searchType === "author") {
        params.author = query;
      } else if (searchType === "topic") {
        params.tags = query.toLowerCase();
      }

      const response = await axios.get<{ results: QuotableQuote[]; totalPages: number }>(
        "https://api.quotable.io/quotes",
        { params, timeout: 10000 }
      );

      const results = response.data.results || [];
      
      for (const q of results) {
        if (quotes.length >= maxResults) break;
        quotes.push({
          quote: q.content,
          speaker: q.author,
          author: q.author,
          work: null,
          sources: ["quotable-api"],
        });
      }

      if (response.data.totalPages <= page || results.length === 0) break;
      page++;
    }

    return quotes;
  } catch (error) {
    console.error("Quotable API error:", error);
    return [];
  }
}
