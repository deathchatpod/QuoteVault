import axios from "axios";

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

export async function searchFavQsAPI(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 100
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }> = [];
    let page = 1;

    while (quotes.length < maxResults && page <= 5) {
      const params: any = { page };

      if (searchType === "author") {
        params.filter = query;
        params.type = "author";
      } else {
        params.filter = query;
      }

      const response = await axios.get<{ quotes: FavQsQuote[] }>(
        "https://favqs.com/api/quotes",
        { params, timeout: 10000, headers: { Authorization: "Token token=\"\"" } }
      );

      const results = response.data.quotes || [];

      for (const q of results) {
        if (quotes.length >= maxResults) break;
        quotes.push({
          quote: q.body,
          speaker: q.author,
          author: q.author,
          work: null,
          sources: ["favqs-api"],
        });
      }

      if (results.length === 0) break;
      page++;
    }

    return quotes;
  } catch (error) {
    console.error("FavQs API error:", error);
    return [];
  }
}
