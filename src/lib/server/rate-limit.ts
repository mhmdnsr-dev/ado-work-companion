import type { NextRequest } from 'next/server';

/**
 * Simple in-memory sliding window rate limiter.
 * Per-process only (same honesty as contact): ineffective across multi-instance serverless.
 */

type RateBucket = { count: number; resetAt: number };

export function clientIpFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function createRateLimiter(options: {
  max: number;
  windowMs: number;
}): {
  isLimited: (key: string) => boolean;
} {
  const buckets = new Map<string, RateBucket>();

  return {
    isLimited(key: string): boolean {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + options.windowMs });
        return false;
      }
      if (existing.count >= options.max) {
        return true;
      }
      existing.count += 1;
      return false;
    },
  };
}

/** Contact form: 5 messages / 15 minutes per IP. */
export const contactRateLimit = createRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
});

/** PAT-backed ADO/Analytics/ExtMgmt proxies: 120 requests / minute per IP. */
export const adoProxyRateLimit = createRateLimiter({
  max: 120,
  windowMs: 60 * 1000,
});

/** Config cookie writes: 30 requests / 15 minutes per IP. */
export const configWriteRateLimit = createRateLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
});
