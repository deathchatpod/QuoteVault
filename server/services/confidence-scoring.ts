/**
 * New confidence scoring algorithm based on cross-source verification
 *
 * - cross_verified: +0.45
 * - ai_only: +0.20
 * - single_source: +0.10
 * - unverified: +0.05
 * - Source diversity (unique source types): up to +0.25
 * - Attribution completeness (author/work/year/reference): up to +0.20
 * - Source count bonus: up to +0.10
 * - Max: 1.0
 */
export function calculateConfidenceScore(quote: {
  verified?: boolean;
  verificationStatus?: string | null;
  sources?: string[] | any;
  sourceConfidence?: string | null;
  author?: string | null;
  work?: string | null;
  year?: string | null;
  reference?: string | null;
  [key: string]: any;
}): number {
  let score = 0;

  // Verification status contribution
  const verificationStatus = quote.verificationStatus || (quote.verified ? "ai_only" : "unverified");
  switch (verificationStatus) {
    case "cross_verified":
      score += 0.45;
      break;
    case "ai_only":
      score += 0.20;
      break;
    case "single_source":
      score += 0.10;
      break;
    case "unverified":
    default:
      score += 0.05;
      break;
  }

  // Source diversity: unique source types (up to +0.25)
  const sources = Array.isArray(quote.sources) ? (quote.sources as string[]) : [];
  const uniqueSources = new Set(sources);
  const diversityScore = Math.min(uniqueSources.size / 4, 1.0) * 0.25;
  score += diversityScore;

  // Attribution completeness (up to +0.20)
  let attributionPoints = 0;
  if (quote.author) attributionPoints++;
  if (quote.work) attributionPoints++;
  if (quote.year) attributionPoints++;
  if (quote.reference) attributionPoints++;
  score += (attributionPoints / 4) * 0.20;

  // Source count bonus (up to +0.10)
  const sourceCountBonus = Math.min(sources.length / 5, 1.0) * 0.10;
  score += sourceCountBonus;

  return Math.min(1.0, Math.max(0.0, score));
}

export function categorizeConfidenceScore(score: number): "high" | "medium" | "low" {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}
