// Based on javascript_anthropic_ai_integrations blueprint integration
import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
import { config } from "../config";

const anthropic = new Anthropic({
  apiKey: config.ai.anthropic.apiKey,
  baseURL: config.ai.anthropic.baseUrl,
});

interface VerificationResult {
  verified: boolean;
  sourceConfidence: "high" | "medium" | "low";
  corrections: {
    speaker?: string;
    author?: string;
    work?: string;
    year?: string;
  };
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

export async function verifyQuote(
  quote: string,
  speaker: string | null,
  author: string | null,
  work: string | null,
  year: string | null
): Promise<{ result: VerificationResult; cost: number }> {
  const prompt = `Verify this quote attribution:
Quote: "${quote}"
Speaker: ${speaker || "Unknown"}
Author: ${author || "Unknown"}
Work: ${work || "Unknown"}
Year: ${year || "Unknown"}

Please verify if:
1. The quote is accurate (not misquoted or paraphrased incorrectly)
2. The attribution to the speaker/character is correct
3. The author attribution is correct
4. The work title is correct
5. The year is accurate

Respond with:
- verified: true if the quote and attributions are accurate, false if there are significant errors
- sourceConfidence: "high", "medium", or "low" based on how confident you are
- corrections: Any corrections to speaker, author, work, or year (leave empty if correct)

Return JSON only.`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const message = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          });

          const content = message.content[0];
          if (content.type !== "text") {
            throw new Error("Unexpected response type");
          }

          return { text: content.text, usage: message.usage };
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

    // Parse the JSON response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const result: VerificationResult = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : {
          verified: false,
          sourceConfidence: "low" as const,
          corrections: {},
        };

    // Use actual token counts from API response
    // Claude Haiku 4.5 pricing: $0.80/MTok input, $4.00/MTok output
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = (inputTokens / 1_000_000) * 0.80 + (outputTokens / 1_000_000) * 4.00;

    return { result, cost };
  } catch (error) {
    console.error("Anthropic verification error:", error);
    return {
      result: {
        verified: false,
        sourceConfidence: "low",
        corrections: {},
      },
      cost: 0,
    };
  }
}

export async function batchVerifyQuotes(
  quotes: Array<{
    quote: string;
    speaker: string | null;
    author: string | null;
    work: string | null;
    year: string | null;
  }>
): Promise<{ results: VerificationResult[]; totalCost: number }> {
  const limit = pLimit(2);

  const verificationPromises = quotes.map((q) =>
    limit(async () => {
      const { result, cost } = await verifyQuote(
        q.quote,
        q.speaker,
        q.author,
        q.work,
        q.year
      );
      return { result, cost };
    })
  );

  const outcomes = await Promise.all(verificationPromises);
  const results = outcomes.map(o => o.result);
  const totalCost = outcomes.reduce((sum, o) => sum + o.cost, 0);
  return { results, totalCost };
}
