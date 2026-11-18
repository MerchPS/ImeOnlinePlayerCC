// Simpan sebagai: src/lib/rateLimit.ts
// Fixed-window limiter di memori. Cukup untuk 1 instance server.
// Kalau nanti jalan di banyak instance (load balancer / Kubernetes), ganti ke Redis.
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k); // cegah memory leak
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}
