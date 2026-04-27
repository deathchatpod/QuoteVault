import { describe, it, expect } from "vitest";
import { calculateConfidenceScore, categorizeConfidenceScore } from "../confidence-scoring";

describe("calculateConfidenceScore", () => {
  it("gives highest score for cross-verified quotes with full attribution", () => {
    const score = calculateConfidenceScore({
      verificationStatus: "cross_verified",
      sources: ["quotable", "wikiquote", "brainyquote", "favqs"],
      author: "Shakespeare",
      work: "Hamlet",
      year: "1600",
      reference: "Act 3, Scene 1",
    });
    // cross_verified: 0.45 + diversity: 0.25 + attribution: 0.20 + source count: 0.08
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it("gives lower score for unverified single-source quotes", () => {
    const score = calculateConfidenceScore({
      verificationStatus: "unverified",
      sources: ["unknown"],
      author: null,
      work: null,
      year: null,
      reference: null,
    });
    // unverified: 0.05 + diversity: ~0.0625 + attribution: 0 + source count: 0.02
    expect(score).toBeLessThan(0.2);
  });

  it("ai_only scores between cross_verified and single_source", () => {
    const aiScore = calculateConfidenceScore({
      verificationStatus: "ai_only",
      sources: ["ai-extraction"],
      author: "Test",
    });
    const crossScore = calculateConfidenceScore({
      verificationStatus: "cross_verified",
      sources: ["a", "b"],
      author: "Test",
    });
    const singleScore = calculateConfidenceScore({
      verificationStatus: "single_source",
      sources: ["a"],
      author: "Test",
    });

    expect(aiScore).toBeGreaterThan(singleScore);
    expect(aiScore).toBeLessThan(crossScore);
  });

  it("rewards source diversity", () => {
    const singleSource = calculateConfidenceScore({
      verificationStatus: "unverified",
      sources: ["a"],
    });
    const multiSource = calculateConfidenceScore({
      verificationStatus: "unverified",
      sources: ["a", "b", "c", "d"],
    });

    expect(multiSource).toBeGreaterThan(singleSource);
  });

  it("rewards attribution completeness", () => {
    const noAttribution = calculateConfidenceScore({
      verificationStatus: "unverified",
      sources: ["a"],
    });
    const fullAttribution = calculateConfidenceScore({
      verificationStatus: "unverified",
      sources: ["a"],
      author: "Author",
      work: "Work",
      year: "2000",
      reference: "p.42",
    });

    expect(fullAttribution).toBeGreaterThan(noAttribution);
  });

  it("never exceeds 1.0", () => {
    const score = calculateConfidenceScore({
      verificationStatus: "cross_verified",
      sources: ["a", "b", "c", "d", "e", "f", "g"],
      author: "A",
      work: "B",
      year: "C",
      reference: "D",
    });
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("never goes below 0.0", () => {
    const score = calculateConfidenceScore({});
    expect(score).toBeGreaterThanOrEqual(0.0);
  });

  it("handles legacy verified boolean when verificationStatus is missing", () => {
    const verifiedScore = calculateConfidenceScore({
      verified: true,
      sources: ["a"],
    });
    const unverifiedScore = calculateConfidenceScore({
      verified: false,
      sources: ["a"],
    });

    expect(verifiedScore).toBeGreaterThan(unverifiedScore);
  });
});

describe("categorizeConfidenceScore", () => {
  it("categorizes high scores correctly", () => {
    expect(categorizeConfidenceScore(0.9)).toBe("high");
    expect(categorizeConfidenceScore(0.7)).toBe("high");
  });

  it("categorizes medium scores correctly", () => {
    expect(categorizeConfidenceScore(0.5)).toBe("medium");
    expect(categorizeConfidenceScore(0.4)).toBe("medium");
  });

  it("categorizes low scores correctly", () => {
    expect(categorizeConfidenceScore(0.3)).toBe("low");
    expect(categorizeConfidenceScore(0.1)).toBe("low");
  });
});
