import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeWikiquote(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 100
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }> = [];
    
    const searchUrl = `https://en.wikiquote.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    const searchResponse = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "QuoteResearchBot/1.0 (Educational Research Tool)",
      },
    });
    
    const searchResults = searchResponse.data.query?.search || [];
    if (searchResults.length === 0) return quotes;

    const pageTitle = searchResults[0].title;
    const pageUrl = `https://en.wikiquote.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
    
    const pageResponse = await axios.get(pageUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "QuoteResearchBot/1.0 (Educational Research Tool)",
      },
    });
    const $ = cheerio.load(pageResponse.data);

    $("ul li").each((_, element) => {
      if (quotes.length >= maxResults) return false;
      
      const text = $(element).text().trim();
      if (text.length > 20 && text.length < 500 && !text.includes("Edit") && !text.includes("Wikipedia")) {
        quotes.push({
          quote: text,
          speaker: pageTitle,
          author: pageTitle,
          work: null,
          sources: ["wikiquote"],
        });
      }
    });

    return quotes;
  } catch (error) {
    console.error("Wikiquote scraping error:", error);
    return [];
  }
}

export async function scrapeProjectGutenberg(
  query: string,
  maxResults: number = 50
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }> = [];
    
    const searchUrl = `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(query)}&submit_search=Go`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "QuoteResearchBot/1.0 (Educational Research Tool)",
      },
    });
    const $ = cheerio.load(response.data);

    $(".booklink").each((_, element) => {
      if (quotes.length >= maxResults) return false;
      
      const title = $(element).find(".title").text().trim();
      const author = $(element).find(".subtitle").text().trim();
      
      if (title && author) {
        quotes.push({
          quote: `Available in Project Gutenberg: ${title}`,
          speaker: null,
          author: author,
          work: title,
          sources: ["project-gutenberg"],
        });
      }
    });

    return quotes;
  } catch (error) {
    console.error("Project Gutenberg scraping error:", error);
    return [];
  }
}
