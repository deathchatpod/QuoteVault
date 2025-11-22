// Based on javascript_gemini_ai_integrations blueprint integration
import { GoogleGenAI, Type } from "@google/genai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import { config } from "../config";

const ai = new GoogleGenAI({
  apiKey: config.ai.gemini.apiKey,
  httpOptions: {
    apiVersion: "",
    baseUrl: config.ai.gemini.baseUrl,
  },
});

interface QuoteExtraction {
  quote: string;
  speaker: string | null;
  author: string | null;
  work: string | null;
  year: string | null;
  type: string | null;
  reference: string | null;
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export async function extractQuotesWithAI(
  rawText: string,
  searchQuery: string,
  searchType: string,
  maxQuotes: number
): Promise<{ quotes: QuoteExtraction[]; cost: number }> {
  const limit = pLimit(2);
  const startTime = Date.now();

  const prompt = `Extract up to ${maxQuotes} famous quotes related to "${searchQuery}" (search type: ${searchType}) from the following text. For each quote, provide:
- quote: The exact quote text
- speaker: Who said it (person or character name)
- author: Who wrote/created it (may be same as speaker or different for characters)
- work: Title of the book, movie, speech, etc.
- year: Publication/release year if known
- type: One of: religious, literature, movie, speech, poem, historical
- reference: For religious texts, the verse/chapter reference

Text to analyze:
${rawText.slice(0, 50000)}`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  quotes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        quote: { type: Type.STRING },
                        speaker: { type: Type.STRING },
                        author: { type: Type.STRING },
                        work: { type: Type.STRING },
                        year: { type: Type.STRING },
                        type: { type: Type.STRING },
                        reference: { type: Type.STRING },
                      },
                      required: ["quote"],
                    },
                  },
                },
                required: ["quotes"],
              },
            },
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );

    const data = JSON.parse(response.text || '{"quotes":[]}');
    const quotes = data.quotes || [];

    // Estimate cost: Gemini Flash is ~$0.00001 per 1000 chars for input, ~$0.00003 per 1000 chars for output
    const inputCost = (prompt.length / 1000) * 0.00001;
    const outputCost = ((response.text?.length || 0) / 1000) * 0.00003;
    const totalCost = inputCost + outputCost;

    return { quotes, cost: totalCost };
  } catch (error) {
    console.error("Gemini extraction error:", error);
    return { quotes: [], cost: 0 };
  }
}

export async function enrichQuoteData(
  quote: string,
  existingData: Partial<QuoteExtraction>
): Promise<{ enrichedData: Partial<QuoteExtraction>; cost: number }> {
  const prompt = `Given this quote: "${quote}"
Current data: ${JSON.stringify(existingData)}

If any fields are missing or incomplete, try to fill them in with accurate information. Return the complete quote data.`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  author: { type: Type.STRING },
                  work: { type: Type.STRING },
                  year: { type: Type.STRING },
                  type: { type: Type.STRING },
                  reference: { type: Type.STRING },
                },
              },
            },
          });
          return result;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );

    const enrichedData = JSON.parse(response.text || "{}");
    const inputCost = (prompt.length / 1000) * 0.00001;
    const outputCost = ((response.text?.length || 0) / 1000) * 0.00003;

    return { enrichedData, cost: inputCost + outputCost };
  } catch (error) {
    console.error("Gemini enrichment error:", error);
    return { enrichedData: existingData, cost: 0 };
  }
}
