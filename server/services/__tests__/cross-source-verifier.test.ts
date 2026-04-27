import { describe, it, expect } from "vitest";
import { passiveSourceAgreement } from "../cross-source-verifier";

describe("passiveSourceAgreement", () => {
  it("marks quotes from 2+ distinct sources as cross_verified", () => {
    const quotes = [
      { quote: "To be or not to be that is the question", sources: ["quotable"], author: "Shakespeare" },
      { quote: "To be or not to be that is the question", sources: ["wikiquote"], author: "William Shakespeare" },
      { quote: "I think therefore I am the philosopher says", sources: ["favqs"], author: "Descartes" },
    ];

    const result = passiveSourceAgreement(quotes);

    // Should have 2 clusters
    expect(result.length).toBe(2);

    // The "to be" cluster should be cross_verified
    const toBeCluster = result.find(c => c.bestQuote.quote.includes("To be"));
    expect(toBeCluster?.verificationStatus).toBe("cross_verified");
    expect(toBeCluster?.distinctSources.length).toBeGreaterThanOrEqual(2);

    // The "I think" cluster should be single_source
    const thinkCluster = result.find(c => c.bestQuote.quote.includes("think"));
    expect(thinkCluster?.verificationStatus).toBe("single_source");
  });

  it("picks the best quote with most metadata", () => {
    const quotes = [
      { quote: "A famous quote here about life", sources: ["a"], author: null, work: null },
      { quote: "A famous quote here about life", sources: ["b"], author: "Author", work: "Book", year: "2020" },
    ];

    const result = passiveSourceAgreement(quotes);
    expect(result.length).toBe(1);
    expect(result[0].bestQuote.author).toBe("Author");
    expect(result[0].bestQuote.work).toBe("Book");
  });

  it("handles empty input", () => {
    const result = passiveSourceAgreement([]);
    expect(result.length).toBe(0);
  });

  it("handles single quote", () => {
    const result = passiveSourceAgreement([
      { quote: "A lonely quote with no friends at all", sources: ["only-source"] },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].verificationStatus).toBe("single_source");
  });

  it("merges sources from multiple similar quotes", () => {
    const quotes = [
      { quote: "The only thing we have to fear is fear itself", sources: ["source1"] },
      { quote: "The only thing we have to fear is fear itself", sources: ["source2"] },
      { quote: "The only thing we have to fear is fear itself", sources: ["source3"] },
    ];

    const result = passiveSourceAgreement(quotes);
    expect(result.length).toBe(1);
    expect(result[0].distinctSources.length).toBe(3);
    expect(result[0].verificationStatus).toBe("cross_verified");
  });
});
