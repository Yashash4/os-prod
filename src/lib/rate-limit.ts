/**
 * In-memory sliding window rate limiter.
 * Keyed by IP + endpoint. Not shared across instances — suitable for
 * single-server deployments. Replace with Redis for multi-instance.
 */

interface SlidingWindow {
  timestamps: number[];
}

const windows = new Map<string, SlidingWindow>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, window] of windows) {
    if (window.timestamps.length === 0) {
      windows.delete(key);
    }
  }
}

export function rateLimit(
  ip: string,
  endpoint: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  cleanup(now);

  const key = `${ip}:${endpoint}`;
  let window = windows.get(key);

  if (!window) {
    window = { timestamps: [] };
    windows.set(key, window);
  }

  // Remove timestamps outside the current window
  const cutoff = now - windowMs;
  window.timestamps = window.timestamps.filter((t) => t > cutoff);

  if (window.timestamps.length >= limit) {
    const oldestInWindow = window.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  window.timestamps.push(now);
  return { allowed: true };
}
