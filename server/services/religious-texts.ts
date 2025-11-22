import axios from "axios";

const USER_AGENT = "QuoteResearchBot/1.0 (Educational Research Tool)";

export async function fetchBhagavadGita(
  query: string,
  maxResults: number = 50
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }> = [];
    
    const response = await axios.get("https://bhagavadgita.io/api/v1/chapters", {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
    });
    
    const chapters = response.data || [];
    
    for (const chapter of chapters.slice(0, 5)) {
      if (quotes.length >= maxResults) break;
      
      const versesResponse = await axios.get(`https://bhagavadgita.io/api/v1/chapters/${chapter.chapter_number}/verses`, {
        timeout: 10000,
        headers: { "User-Agent": USER_AGENT },
      });
      
      const verses = versesResponse.data || [];
      
      for (const verse of verses) {
        if (quotes.length >= maxResults) break;
        
        if (verse.text && (
          verse.text.toLowerCase().includes(query.toLowerCase()) ||
          verse.transliteration?.toLowerCase().includes(query.toLowerCase()) ||
          verse.word_meanings?.toLowerCase().includes(query.toLowerCase())
        )) {
          quotes.push({
            quote: verse.text,
            speaker: "Krishna",
            author: "Vyasa",
            work: "Bhagavad Gita",
            reference: `Chapter ${chapter.chapter_number}, Verse ${verse.verse_number}`,
            sources: ["bhagavad-gita"],
          });
        }
      }
    }

    return quotes;
  } catch (error) {
    console.error("Bhagavad Gita API error:", error);
    return [];
  }
}

export async function fetchDhammapada(
  query: string,
  maxResults: number = 50
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }> = [];
    
    const response = await axios.get("https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.intro.budd.html", {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
    });
    
    const versePattern = /(\d+)\.\s*([\s\S]+?)(?=\d+\.|$)/g;
    const matches = [...response.data.matchAll(versePattern)];
    
    for (const match of matches) {
      if (quotes.length >= maxResults) break;
      
      const verseNumber = match[1];
      const verseText = match[2].trim();
      
      if (verseText.toLowerCase().includes(query.toLowerCase()) || query === "") {
        quotes.push({
          quote: verseText,
          speaker: "Buddha",
          author: "Buddha",
          work: "Dhammapada",
          reference: `Verse ${verseNumber}`,
          sources: ["dhammapada"],
        });
      }
    }

    return quotes;
  } catch (error) {
    console.error("Dhammapada fetch error:", error);
    return [];
  }
}

export async function fetchHadith(
  query: string,
  maxResults: number = 50
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }> = [];
    
    const searchUrl = `https://api.sunnah.com/v1/collections/bukhari/hadiths?q=${encodeURIComponent(query)}&limit=${maxResults}`;
    
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { 
        "User-Agent": USER_AGENT,
        "X-API-Key": process.env.SUNNAH_API_KEY || "",
      },
    });
    
    const hadiths = response.data.data || [];
    
    for (const hadith of hadiths) {
      if (quotes.length >= maxResults) break;
      
      quotes.push({
        quote: hadith.hadith?.[0]?.body || hadith.body,
        speaker: "Prophet Muhammad",
        author: hadith.narrator || "Various",
        work: `Sahih al-Bukhari`,
        reference: hadith.hadithNumber || hadith.id,
        sources: ["hadith-bukhari"],
      });
    }

    return quotes;
  } catch (error) {
    console.error("Hadith API error:", error);
    return [];
  }
}

export async function fetchBuddhistSutras(
  query: string,
  maxResults: number = 50
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; sources: string[] }> = [];
    
    const searchUrl = `https://www.accesstoinsight.org/tipitaka/search.php?query=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: { "User-Agent": USER_AGENT },
    });
    
    const resultPattern = /<a href="([^"]+)"[^>]*>([^<]+)<\/a>[^<]*<p>([^<]+)<\/p>/g;
    const matches = [...response.data.matchAll(resultPattern)];
    
    for (const match of matches.slice(0, maxResults)) {
      const [, link, title, excerpt] = match;
      
      quotes.push({
        quote: excerpt.trim(),
        speaker: "Buddha",
        author: "Buddha",
        work: title.trim(),
        reference: link,
        sources: ["buddhist-sutras"],
      });
    }

    return quotes;
  } catch (error) {
    console.error("Buddhist sutras fetch error:", error);
    return [];
  }
}
