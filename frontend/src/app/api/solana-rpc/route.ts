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

export async function POST(request: NextRequest) {
  const network =
    request.nextUrl.searchParams.get("network") === "devnet"
      ? "devnet"
      : "mainnet-beta";

  const rpcUrl =
    process.env.SOLANA_RPC_URL ??
    clusterApiUrl(network);

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
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
