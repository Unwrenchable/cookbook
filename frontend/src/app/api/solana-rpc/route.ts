/**
 * /api/solana-rpc – Server-side Solana JSON-RPC proxy.
 *
 * Forwards JSON-RPC requests to the private Solana RPC endpoint using the
 * server-only SOLANA_RPC_URL environment variable, keeping any embedded API
 * key out of the browser bundle.
 *
 * Falls back to the public Solana cluster endpoint when SOLANA_RPC_URL is not
 * set (devnet or mainnet-beta depending on the ?network= query parameter).
 *
 * Usage (client-side): POST /api/solana-rpc?network=<devnet|mainnet-beta>
 */
import { NextRequest, NextResponse } from "next/server";
import { clusterApiUrl } from "@solana/web3.js";

/** Maximum allowed JSON-RPC body size (32 KB). */
const MAX_BODY_BYTES = 32 * 1024;

/** Allowlist of Solana JSON-RPC methods the proxy will forward. */
const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlock",
  "getBlockHeight",
  "getBlockProduction",
  "getBlockTime",
  "getBlocks",
  "getClusterNodes",
  "getEpochInfo",
  "getFeeForMessage",
  "getGenesisHash",
  "getHealth",
  "getInflationRate",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getRecentBlockhash",
  "getRecentPerformanceSamples",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getSlot",
  "getStakeActivation",
  "getSupply",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTokenLargestAccounts",
  "getTokenSupply",
  "getTransaction",
  "getTransactionCount",
  "getVersion",
  "getVoteAccounts",
  "isBlockhashValid",
  "minimumLedgerSlot",
  "requestAirdrop",
  "sendTransaction",
  "simulateTransaction",
]);

export async function POST(request: NextRequest) {
  const network =
    request.nextUrl.searchParams.get("network") === "devnet"
      ? "devnet"
      : "mainnet-beta";

  const rpcUrl =
    process.env.SOLANA_RPC_URL ??
    clusterApiUrl(network);

  // Enforce body size limit
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  // Validate JSON and enforce method allowlist
  let parsed: { method?: unknown } | Array<{ method?: unknown }>;
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requests = Array.isArray(parsed) ? parsed : [parsed];
  for (const rpc of requests) {
    if (typeof rpc.method !== "string" || !ALLOWED_METHODS.has(rpc.method)) {
      return NextResponse.json(
        { error: `Method not allowed: ${String(rpc.method)}` },
        { status: 403 }
      );
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return NextResponse.json(
      { error: "Solana RPC unreachable" },
      { status: 502 }
    );
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
