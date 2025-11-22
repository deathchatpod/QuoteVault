import axios from "axios";

interface SefariaText {
  text: string | string[];
  ref: string;
  heRef?: string;
  book?: string;
  categories?: string[];
}

const religiousTexts = [
  // Bible
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "I Samuel", "II Samuel",
  "I Kings", "II Kings", "Isaiah", "Jeremiah", "Ezekiel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
  "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
  "Zechariah", "Malachi", "Psalms", "Proverbs", "Job",
  "Song of Songs", "Ecclesiastes", "Lamentations", "Esther",
  "Daniel", "Ezra", "Nehemiah", "I Chronicles", "II Chronicles",
  // Quran
  "Quran",
  // Talmud (sample tractates)
  "Berakhot", "Shabbat", "Eruvin", "Pesachim", "Yoma",
];

export async function searchSefariaAPI(
  query: string,
  searchType: "topic" | "author" | "work",
  maxResults: number = 100
): Promise<Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; type: string; sources: string[] }>> {
  try {
    const quotes: Array<{ quote: string; speaker: string | null; author: string | null; work: string | null; reference: string | null; type: string; sources: string[] }> = [];

    // Search across religious texts
    for (const bookName of religiousTexts) {
      if (quotes.length >= maxResults) break;

      try {
        const response = await axios.get<SefariaText>(
          `https://www.sefaria.org/api/texts/${encodeURIComponent(bookName)}.1`,
          { timeout: 10000 }
        );

        if (response.data && response.data.text) {
          const textArray = Array.isArray(response.data.text)
            ? response.data.text
            : [response.data.text];

          for (let i = 0; i < textArray.length && quotes.length < maxResults; i++) {
            const text = textArray[i];
            if (text && typeof text === "string" && text.length > 20 && text.length < 500) {
              // Check if text is relevant to query
              if (searchType === "topic" && text.toLowerCase().includes(query.toLowerCase())) {
                const isQuran = bookName === "Quran";
                const isTalmud = ["Berakhot", "Shabbat", "Eruvin", "Pesachim", "Yoma"].includes(bookName);

                quotes.push({
                  quote: text,
                  speaker: null,
                  author: null,
                  work: bookName,
                  reference: response.data.ref || `${bookName} ${i + 1}`,
                  type: isQuran ? "religious" : isTalmud ? "religious" : "religious",
                  sources: ["sefaria-api"],
                });
              }
            }
          }
        }
      } catch (error) {
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return quotes;
  } catch (error) {
    console.error("Sefaria API error:", error);
    return [];
  }
}
