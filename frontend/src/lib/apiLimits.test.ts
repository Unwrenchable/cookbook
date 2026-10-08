import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowRequest, clientKey, rpcBatchError } from "./apiLimits.ts";

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

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    const headers = new Map([["x-forwarded-for", "203.0.113.5, 10.0.0.1"]]);
    assert.equal(clientKey((name) => headers.get(name) ?? null), "203.0.113.5");
  });
});
