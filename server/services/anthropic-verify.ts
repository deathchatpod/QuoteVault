// Based on javascript_anthropic_ai_integrations blueprint integration
import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import pRetry from "p-retry";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL!,
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
          throw new pRetry.AbortError(error);
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

    // Estimate cost: Claude Haiku is ~$0.00025 per 1000 input tokens, ~$0.00125 per 1000 output tokens
    // Rough estimate: 1 token ≈ 4 characters
    const inputTokens = prompt.length / 4;
    const outputTokens = response.text.length / 4;
    const cost = (inputTokens / 1000) * 0.00025 + (outputTokens / 1000) * 0.00125;

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
  let totalCost = 0;

  const verificationPromises = quotes.map((q) =>
    limit(async () => {
      const { result, cost } = await verifyQuote(
        q.quote,
        q.speaker,
        q.author,
        q.work,
        q.year
      );
      totalCost += cost;
      return result;
    })
  );

  const results = await Promise.all(verificationPromises);
  return { results, totalCost };
}
