/**
 * Token bucket rate limiter for managing API call rates
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async consume(count: number = 1): Promise<void> {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return;
    }

    // Wait until we have enough tokens
    const waitTime = ((count - this.tokens) / this.refillRate) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    this.refill();
    this.tokens -= count;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Centralized rate limit manager for all quote source adapters
 */
class RateLimitManager {
  private buckets = new Map<string, TokenBucket>();

  /**
   * Register a rate limiter for a specific adapter
   * @param adapterId - Unique identifier for the adapter
   * @param rateLimit - Requests per minute (0 for unlimited)
   */
  register(adapterId: string, rateLimit: number) {
    if (rateLimit === 0) {
      // No rate limit
      return;
    }

    // Convert requests/minute to requests/second
    const refillRate = rateLimit / 60;
    const capacity = Math.max(rateLimit, 10); // Bucket capacity is at least 10 or rateLimit
    
    this.buckets.set(adapterId, new TokenBucket(capacity, refillRate));
  }

  /**
   * Wait until the rate limit allows the request
   * @param adapterId - Adapter making the request
   * @param count - Number of requests (default 1)
   */
  async acquire(adapterId: string, count: number = 1): Promise<void> {
    const bucket = this.buckets.get(adapterId);
    if (!bucket) {
      // No rate limit configured
      return;
    }

    await bucket.consume(count);
  }

  /**
   * Check available tokens without consuming
   */
  getAvailable(adapterId: string): number {
    const bucket = this.buckets.get(adapterId);
    return bucket ? bucket.getAvailableTokens() : Infinity;
  }
}

export const rateLimitManager = new RateLimitManager();
