import axios from "axios";
import pRetry from "p-retry";

export interface PaginatedFetchOptions<T> {
  /** Base URL for the API */
  baseUrl: string;
  /** Maximum number of pages to fetch (default: 10) */
  maxPages?: number;
  /** Function to build the full URL for a given page number */
  buildUrl: (page: number) => string;
  /** Function to extract results array from the API response */
  extractResults: (responseData: any) => T[];
  /** Function to check if there are more pages (optional, defaults to checking if results are empty) */
  hasMorePages?: (responseData: any, page: number) => boolean;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Request headers (optional) */
  headers?: Record<string, string>;
  /** Delay between requests in milliseconds (optional, for rate limiting) */
  delayMs?: number;
}

/**
 * Generic paginated API fetcher with retry logic and error handling.
 * Eliminates duplicate pagination code across API adapters.
 */
export async function fetchPaginated<T>(
  options: PaginatedFetchOptions<T>
): Promise<T[]> {
  const {
    baseUrl,
    maxPages = 10,
    buildUrl,
    extractResults,
    hasMorePages,
    timeout = 10000,
    headers,
    delayMs = 0,
  } = options;

  const allResults: T[] = [];
  let page = 1;

  while (page <= maxPages) {
    try {
      const response = await pRetry(
        () =>
          axios.get(buildUrl(page), {
            timeout,
            headers,
          }),
        {
          retries: 2,
          minTimeout: 1000,
          onFailedAttempt: (error) => {
            console.warn(
              `Request to ${baseUrl} failed (attempt ${error.attemptNumber}): ${String(error)}`
            );
          },
        }
      );

      const pageResults = extractResults(response.data);

      // No results, stop pagination
      if (pageResults.length === 0) {
        break;
      }

      allResults.push(...pageResults);

      // Check if there are more pages using custom logic or default
      const shouldContinue = hasMorePages
        ? hasMorePages(response.data, page)
        : true;

      if (!shouldContinue) {
        break;
      }

      page++;

      // Optional delay between requests to respect rate limits
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error: any) {
      console.error(`Pagination error on page ${page} for ${baseUrl}:`, error.message);
      // Stop pagination on error rather than continuing with potentially incomplete data
      break;
    }
  }

  return allResults;
}

/**
 * Build query params for axios from an object, filtering out undefined/null values
 */
export function buildQueryParams(params: Record<string, any>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      filtered[key] = String(value);
    }
  }
  return filtered;
}
