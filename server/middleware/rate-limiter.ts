import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

/**
 * Simple in-memory token-bucket rate limiter per IP
 */
export function createRateLimiter(opts: {
  maxRequests: number;
  windowSeconds: number;
}) {
  const { maxRequests, windowSeconds } = opts;
  const store = new Map<string, RateLimitEntry>();

  // Cleanup stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (now - entry.lastRefill > windowSeconds * 2000) {
        store.delete(key);
      }
    });
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry) {
      entry = { tokens: maxRequests, lastRefill: now };
      store.set(ip, entry);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - entry.lastRefill) / 1000;
    const refillRate = maxRequests / windowSeconds;
    entry.tokens = Math.min(maxRequests, entry.tokens + elapsed * refillRate);
    entry.lastRefill = now;

    if (entry.tokens < 1) {
      const retryAfter = Math.ceil((1 - entry.tokens) / refillRate);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter,
      });
    }

    entry.tokens -= 1;
    next();
  };
}
