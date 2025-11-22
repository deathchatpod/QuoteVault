export function calculateConfidenceScore(
  verified: boolean,
  sourceConfidence: "high" | "medium" | "low",
  sources: string[],
  hasReference: boolean
): number {
  let score = 0;

  if (verified) {
    score += 0.4;
  } else {
    score += 0.1;
  }

  switch (sourceConfidence) {
    case "high":
      score += 0.3;
      break;
    case "medium":
      score += 0.2;
      break;
    case "low":
      score += 0.1;
      break;
  }

  const sourceCount = sources.length;
  if (sourceCount >= 3) {
    score += 0.2;
  } else if (sourceCount === 2) {
    score += 0.15;
  } else if (sourceCount === 1) {
    score += 0.1;
  }

  if (hasReference) {
    score += 0.1;
  }

  return Math.min(1.0, Math.max(0.0, score));
}

export function categorizeConfidenceScore(score: number): "high" | "medium" | "low" {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}
