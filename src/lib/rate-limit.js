// Tiny in-memory rate limiter. Per-process, so it does NOT survive restarts
// and does NOT coordinate across multiple Node workers. For real production
// scale put a WAF / Cloudflare / Redis-backed limiter in front. This is a
// "make casual abuse expensive" measure, not a hard guarantee.

const buckets = new Map();

// Periodically prune to keep the map from growing forever.
const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = Date.now();

function prune(now) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
  lastPrune = now;
}

/**
 * Fixed-window limiter.
 *   key       – string identifying the client (usually IP+route)
 *   limit     – max requests per window
 *   windowMs  – window length
 * Returns { ok, remaining, resetAt }.
 */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  prune(now);

  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Best-effort client IP. Trusts the first hop of x-forwarded-for, which is
// fine behind a known reverse proxy. If you put this directly on the
// internet without a proxy, that header is spoofable.
export function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}