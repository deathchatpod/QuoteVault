import { describe, it, expect } from "vitest";
import { computeQuoteSimilarity, clusterQuotesBySimilarity, SIMILARITY_THRESHOLD } from "../quote-similarity";

describe("computeQuoteSimilarity", () => {
  it("returns 1.0 for identical quotes", () => {
    const quote = "To be or not to be, that is the question.";
    const score = computeQuoteSimilarity(quote, quote);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it("returns high similarity for nearly identical quotes", () => {
    const a = "To be or not to be, that is the question.";
    const b = "To be, or not to be, that is the question";
    const score = computeQuoteSimilarity(a, b);
    expect(score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });

  it("returns high similarity for quotes with minor word differences", () => {
    const a = "The only thing we have to fear is fear itself.";
    const b = "The only thing we have to fear is fear itself";
    const score = computeQuoteSimilarity(a, b);
    expect(score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });

  it("returns low similarity for completely different quotes", () => {
    const a = "To be or not to be, that is the question.";
    const b = "In the beginning God created the heavens and the earth.";
    const score = computeQuoteSimilarity(a, b);
    expect(score).toBeLessThan(0.3);
  });

  it("returns moderate similarity for thematically related but different quotes", () => {
    const a = "Love is patient, love is kind.";
    const b = "All you need is love, love is all you need.";
    const score = computeQuoteSimilarity(a, b);
    // They share "love" but are different quotes
    expect(score).toBeLessThan(SIMILARITY_THRESHOLD);
  });

  it("handles empty strings", () => {
    expect(computeQuoteSimilarity("", "hello")).toBe(0);
    expect(computeQuoteSimilarity("hello", "")).toBe(0);
    expect(computeQuoteSimilarity("", "")).toBe(0);
  });

  it("is case insensitive", () => {
    const a = "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG";
    const b = "the quick brown fox jumps over the lazy dog";
    const score = computeQuoteSimilarity(a, b);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it("ignores punctuation", () => {
    const a = "Hello, world! How are you?";
    const b = "Hello world How are you";
    const score = computeQuoteSimilarity(a, b);
    expect(score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });
});

describe("clusterQuotesBySimilarity", () => {
  it("groups identical quotes into one cluster", () => {
    const quotes = [
      { quote: "To be or not to be that is the question we must answer", sources: ["source1"] },
      { quote: "To be or not to be that is the question we must answer", sources: ["source2"] },
      { quote: "Something completely different from everything else in the world", sources: ["source3"] },
    ];

    const clusters = clusterQuotesBySimilarity(quotes);
    expect(clusters.length).toBe(2);

    const largeCluster = clusters.find(c => c.length === 2);
    expect(largeCluster).toBeDefined();
  });

  it("keeps distinct quotes in separate clusters", () => {
    const quotes = [
      { quote: "The quick brown fox jumps over lazy dog", sources: ["a"] },
      { quote: "In beginning God created heavens and earth", sources: ["b"] },
      { quote: "I think therefore I am says the philosopher", sources: ["c"] },
    ];

    const clusters = clusterQuotesBySimilarity(quotes);
    expect(clusters.length).toBe(3);
  });

  it("handles empty input", () => {
    const clusters = clusterQuotesBySimilarity([]);
    expect(clusters.length).toBe(0);
  });
});
