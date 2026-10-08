/** Shared limits for the public API routes. No secrets, no Next.js imports. */

export const MAX_RPC_BODY_BYTES = 32 * 1024;
export const MAX_RPC_BATCH = 8;
export const MAX_METHOD_LEN = 64;

const hits = new Map<string, { count: number; resetAt: number }>();

/** Best-effort per-instance limit. Serverless hosts do not share this map. */
export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (hits.size > 5000) hits.clear();
  const row = hits.get(key);
  if (!row || now >= row.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  row.count += 1;
  return row.count <= limit;
}

export function clientKey(header: (name: string) => string | null): string {
  const forwarded = header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded && forwarded.length <= 80) return forwarded;
  const realIp = header("x-real-ip")?.trim();
  if (realIp && realIp.length <= 80) return realIp;
  return "unknown";
}

export function rpcBatchError(parsed: unknown, allowed: ReadonlySet<string>): string | null {
  const requests = Array.isArray(parsed) ? parsed : [parsed];
  if (requests.length === 0 || requests.length > MAX_RPC_BATCH) {
    return "Too many RPC calls";
  }
  for (const rpc of requests) {
    if (!rpc || typeof rpc !== "object") return "Invalid RPC request";
    const method = (rpc as { method?: unknown }).method;
    if (typeof method !== "string" || method.length === 0 || method.length > MAX_METHOD_LEN || !allowed.has(method)) {
      return "Method not allowed";
    }
  }
  return null;
}

export interface RateLimitStore {
  url: string;
  token: string;
}

/** Upstash Redis REST or Vercel KV. Empty values mean "not configured". */
export function rateLimitStore(env: Record<string, string | undefined>): RateLimitStore | null {
  const url = (env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "").replace(/\/$/, "");
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "";
  if (!url || !token) return null;
  return { url, token };
}

export function rateLimitCommands(key: string, now: number, windowMs: number, member: string): string[][] {
  return [
    ["ZREMRANGEBYSCORE", key, "0", String(now - windowMs)],
    ["ZADD", key, String(now), member],
    ["ZCARD", key],
    ["PEXPIRE", key, String(windowMs)],
  ];
}

export function slidingWindowAllowed(count: number, limit: number): boolean {
  return Number.isFinite(count) && count >= 0 && count <= limit;
}

/**
 * Shared sliding window when a Redis/KV REST store is configured.
 * Falls back to the in-memory limiter only when the store is unset.
 * A configured store that errors denies the request.
 */
export async function allowRequestShared(
  key: string,
  limit: number,
  windowMs: number,
  opts: {
    now?: number;
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    member?: string;
  } = {}
): Promise<boolean> {
  const env = opts.env ?? process.env;
  const store = rateLimitStore(env);
  const now = opts.now ?? Date.now();
  if (!store) return allowRequest(key, limit, windowMs, now);

  const member = opts.member ?? `${now}:${Math.random().toString(16).slice(2)}`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${store.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${store.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rateLimitCommands(key, now, windowMs, member)),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as Array<{ result?: unknown }>;
    return slidingWindowAllowed(Number(body?.[2]?.result), limit);
  } catch {
    return false;
  }
}
