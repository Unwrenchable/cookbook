import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowRequest, allowRequestShared, clientKey, rateLimitStore, rpcBatchError, slidingWindowAllowed } from "./apiLimits.ts";

describe("rpcBatchError", () => {
  const allowed = new Set(["eth_chainId", "getBalance"]);

  it("accepts one allowlisted call", () => {
    assert.equal(rpcBatchError({ method: "eth_chainId" }, allowed), null);
  });

  it("rejects a method outside the allowlist without echoing it", () => {
    const err = rpcBatchError({ method: "debug_traceTransaction" }, allowed);
    assert.equal(err, "Method not allowed");
    assert.ok(!err?.includes("debug_trace"));
  });

  it("rejects batches over the cap", () => {
    const batch = Array.from({ length: 9 }, () => ({ method: "getBalance" }));
    assert.equal(rpcBatchError(batch, allowed), "Too many RPC calls");
  });
});

describe("allowRequest", () => {
  it("blocks the call after the limit inside one window", () => {
    const key = `t-${Math.random()}`;
    assert.equal(allowRequest(key, 2, 60_000, 1_000), true);
    assert.equal(allowRequest(key, 2, 60_000, 1_001), true);
    assert.equal(allowRequest(key, 2, 60_000, 1_002), false);
    assert.equal(allowRequest(key, 2, 60_000, 61_000), true);
  });
});

describe("shared rate limit", () => {
  it("uses memory when the store is not configured", async () => {
    assert.equal(rateLimitStore({}), null);
    assert.equal(rateLimitStore({ UPSTASH_REDIS_REST_URL: "https://example.upstash.io" }), null);
    const key = `mem-${Date.now()}`;
    assert.equal(await allowRequestShared(key, 1, 60_000, { now: 5_000, env: {} }), true);
    assert.equal(await allowRequestShared(key, 1, 60_000, { now: 5_001, env: {} }), false);
  });

  it("reads the shared count and denies when the store errors", async () => {
    const env = {
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    };
    assert.equal(slidingWindowAllowed(2, 2), true);
    assert.equal(slidingWindowAllowed(3, 2), false);

    const ok = async () => new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 2 }, { result: 1 }]), { status: 200 });
    assert.equal(await allowRequestShared("k", 2, 60_000, { env, fetchImpl: ok as typeof fetch, member: "m" }), true);

    const over = async () => new Response(JSON.stringify([{ result: 1 }, { result: 1 }, { result: 3 }, { result: 1 }]), { status: 200 });
    assert.equal(await allowRequestShared("k", 2, 60_000, { env, fetchImpl: over as typeof fetch, member: "m" }), false);

    const down = async () => {
      throw new Error("redis down");
    };
    assert.equal(await allowRequestShared("k", 2, 60_000, { env, fetchImpl: down as typeof fetch, member: "m" }), false);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    const headers = new Map([["x-forwarded-for", "203.0.113.5, 10.0.0.1"]]);
    assert.equal(clientKey((name) => headers.get(name) ?? null), "203.0.113.5");
  });
});
