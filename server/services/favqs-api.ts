import { fetchPaginated } from "./api-utils";

interface FavQsQuote {
  id: number;
  dialogue: boolean;
  private: boolean;
  tags: string[];
  url: string;
  favorites_count: number;
  upvotes_count: number;
  downvotes_count: number;
  author: string;
  author_permalink: string;
  body: string;
}

interface FavQsResponse {
  quotes: FavQsQuote[];
}

export async function searchFavQsAPI(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 100
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const rawQuotes = await fetchPaginated<FavQsQuote>({
      baseUrl: "https://favqs.com/api/quotes",
      maxPages: 5,
      buildUrl: (page) => {
        const params = new URLSearchParams({ page: String(page) });

        if (searchType === "author") {
          params.set("filter", query);
          params.set("type", "author");
        } else {
          params.set("filter", query);
        }

        return `https://favqs.com/api/quotes?${params.toString()}`;
      },
      extractResults: (data: FavQsResponse) => data.quotes || [],
      timeout: 10000,
      headers: { Authorization: 'Token token=""' },
    });

    // Transform and limit results
    return rawQuotes.slice(0, maxResults).map((q) => ({
      quote: q.body,
      speaker: q.author,
      author: q.author,
      work: null,
      sources: ["favqs-api"],
    }));
  } catch (error) {
    console.error("FavQs API error:", error);
    return [];
  }
}
