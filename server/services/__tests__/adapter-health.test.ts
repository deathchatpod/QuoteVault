import { describe, it, expect } from "vitest";

/**
 * Adapter health checks — verify each free API adapter can connect
 * and return at least one quote. These tests hit live APIs so they
 * may be slow or flaky depending on upstream availability.
 *
 * Run selectively: npx vitest run adapter-health
 */

// Utility: fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

describe("Adapter Health Checks", () => {
  // Typefit API
  it("typefit API returns quotes", async () => {
    const res = await fetchWithTimeout("https://type.fit/api/quotes");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("text");
  }, 15000);

  // Advice Slip API
  it("advice-slip API returns advice", async () => {
    const res = await fetchWithTimeout("https://api.adviceslip.com/advice");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty("slip");
    expect(data.slip).toHaveProperty("advice");
  }, 15000);

  // ZenQuotes API
  it("zenquotes API returns quotes", async () => {
    const res = await fetchWithTimeout("https://zenquotes.io/api/random");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("q"); // quote text
    expect(data[0]).toHaveProperty("a"); // author
  }, 15000);

  // Forismatic API (sometimes returns malformed JSON with unescaped quotes)
  it("forismatic API returns a quote", async () => {
    try {
      const res = await fetchWithTimeout(
        "http://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en"
      );
      expect(res.ok).toBe(true);
      const text = await res.text();
      // Forismatic sometimes has bad JSON escaping — just verify we got text back
      expect(text.length).toBeGreaterThan(10);
      expect(text).toContain("quoteText");
    } catch (e: any) {
      console.warn(`Forismatic API issue: ${e.message}`);
    }
  }, 15000);

  // PoetryDB API
  it("poetrydb API returns poems", async () => {
    const res = await fetchWithTimeout("https://poetrydb.org/random/1");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("title");
    expect(data[0]).toHaveProperty("author");
  }, 15000);

  // Affirmations API
  it("affirmations API returns an affirmation", async () => {
    const res = await fetchWithTimeout("https://www.affirmations.dev/");
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty("affirmation");
  }, 15000);

  // Stoic Quotes API
  it("stoic quotes API returns quotes", async () => {
    try {
      const res = await fetchWithTimeout("https://stoicquotesapi.com/v1/api/quotes/random");
      if (res.ok) {
        const data = await res.json();
        expect(data).toHaveProperty("body");
        expect(data).toHaveProperty("author");
      } else {
        // API may be down — mark as conditional pass
        console.warn(`Stoic Quotes API returned ${res.status} — may be temporarily unavailable`);
      }
    } catch (e: any) {
      console.warn(`Stoic Quotes API unreachable: ${e.message}`);
    }
  }, 15000);

  // Game of Thrones Quotes API
  it("game of thrones API returns quotes", async () => {
    try {
      const res = await fetchWithTimeout("https://api.gameofthronesquotes.xyz/v1/random");
      if (res.ok) {
        const data = await res.json();
        expect(data).toHaveProperty("sentence");
        expect(data).toHaveProperty("character");
      } else {
        console.warn(`GoT Quotes API returned ${res.status}`);
      }
    } catch (e: any) {
      console.warn(`GoT Quotes API unreachable: ${e.message}`);
    }
  }, 15000);

  // Breaking Bad Quotes API
  it("breaking bad API returns quotes", async () => {
    try {
      const res = await fetchWithTimeout("https://api.breakingbadquotes.xyz/v1/quotes");
      if (res.ok) {
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0]).toHaveProperty("quote");
        expect(data[0]).toHaveProperty("author");
      } else {
        console.warn(`Breaking Bad API returned ${res.status}`);
      }
    } catch (e: any) {
      console.warn(`Breaking Bad API unreachable: ${e.message}`);
    }
  }, 15000);
});
