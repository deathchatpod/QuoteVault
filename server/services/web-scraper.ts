import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT = "QuoteResearchBot/1.0 (Educational Research Tool)";

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
      headers: { "User-Agent": USER_AGENT },
    });
    
    const searchResults = searchResponse.data.query?.search || [];
    if (searchResults.length === 0) return quotes;

    const pageTitle = searchResults[0].title;
    const pageUrl = `https://en.wikiquote.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
    
    const pageResponse = await axios.get(pageUrl, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
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
      headers: { "User-Agent": USER_AGENT },
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

export async function scrapeWikipedia(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 100
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }> = [];

    // Search Wikipedia for the query
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + " quote")}&format=json&origin=*`;
    const searchResponse = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
    });

    const searchResults = searchResponse.data.query?.search || [];
    if (searchResults.length === 0) return quotes;

    const pageTitle = searchResults[0].title;

    // Fetch full HTML to extract blockquote elements and "Notable quotes" sections
    const htmlUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`;
    const pageResponse = await axios.get(htmlUrl, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
    });

    const html = pageResponse.data.parse?.text?.["*"] || "";
    const $ = cheerio.load(html);

    // Extract from <blockquote> elements
    $("blockquote").each((_, el) => {
      if (quotes.length >= maxResults) return false;
      const text = $(el).text().trim();
      if (text.length > 20 && text.length < 500) {
        quotes.push({
          quote: text,
          speaker: searchType === "author" ? query : null,
          author: searchType === "author" ? query : pageTitle,
          work: null,
          sources: ["wikipedia"],
        });
      }
    });

    // Extract from sections titled "Notable quotes" or "Quotations"
    $("h2, h3").each((_, heading) => {
      const headingText = $(heading).text().trim().toLowerCase();
      if (headingText.includes("notable quotes") || headingText.includes("quotations") || headingText.includes("famous quotes")) {
        let nextEl = $(heading).next();
        while (nextEl.length && !nextEl.is("h2, h3")) {
          if (nextEl.is("ul, ol")) {
            nextEl.find("li").each((_, li) => {
              if (quotes.length >= maxResults) return false;
              const text = $(li).text().trim();
              if (text.length > 20 && text.length < 500) {
                quotes.push({
                  quote: text,
                  speaker: searchType === "author" ? query : null,
                  author: searchType === "author" ? query : pageTitle,
                  work: null,
                  sources: ["wikipedia"],
                });
              }
            });
          }
          nextEl = nextEl.next();
        }
      }
    });

    return quotes;
  } catch (error) {
    console.error("Wikipedia scraping error:", error);
    return [];
  }
}

export async function scrapeWikidata(
  query: string,
  searchType: "topic" | "author" | "work"
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; sources: string[] }> = [];
    
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&origin=*`;
    const searchResponse = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
    });
    
    const searchResults = searchResponse.data.search || [];
    if (searchResults.length === 0) return quotes;

    const entityId = searchResults[0].id;
    
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json&origin=*`;
    const entityResponse = await axios.get(entityUrl, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
    });
    
    const entity = entityResponse.data.entities?.[entityId];
    const claims = entity?.claims || {};
    
    const notableWorkClaims = claims.P1448 || claims.P1559 || [];
    for (const claim of notableWorkClaims.slice(0, 10)) {
      const value = claim.mainsnak?.datavalue?.value;
      if (value && typeof value === 'object' && 'text' in value) {
        quotes.push({
          quote: value.text,
          speaker: searchType === "author" ? query : null,
          author: searchType === "author" ? query : searchResults[0].label,
          work: null,
          sources: ["wikidata"],
        });
      }
    }

    return quotes;
  } catch (error) {
    console.error("Wikidata scraping error:", error);
    return [];
  }
}
