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
