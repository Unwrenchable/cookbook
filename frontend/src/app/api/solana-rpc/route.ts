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
import { allowRequest, clientKey, MAX_RPC_BODY_BYTES, rpcBatchError } from "@/lib/apiLimits";

/** Allowlist of Solana JSON-RPC methods the proxy will forward. requestAirdrop is omitted: it spends faucet SOL and RPC credit. */
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

  if (!allowRequest(`solana:${clientKey((name) => request.headers.get(name))}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_RPC_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  if (body.length > MAX_RPC_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rejected = rpcBatchError(parsed, ALLOWED_METHODS);
  if (rejected) {
    return NextResponse.json({ error: rejected }, { status: rejected === "Method not allowed" ? 403 : 400 });
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
