/**
 * /api/rpc/[chain] – Server-side EVM JSON-RPC proxy.
 *
 * Forwards JSON-RPC requests to Alchemy using the server-only ALCHEMY_KEY
 * environment variable, keeping the key out of the browser bundle entirely.
 *
 * Usage (client-side): POST /api/rpc/<chainId>  with a JSON-RPC body.
 */
import { NextRequest, NextResponse } from "next/server";

/** Mapping from EVM chain ID → Alchemy network slug */
const ALCHEMY_NETWORKS: Record<string, string> = {
  "1":        "eth-mainnet",
  "11155111": "eth-sepolia",
  "137":      "polygon-mainnet",
  "80002":    "polygon-amoy",
  "42161":    "arb-mainnet",
  "421614":   "arb-sepolia",
  "8453":     "base-mainnet",
  "84532":    "base-sepolia",
  "10":       "opt-mainnet",
  "11155420": "opt-sepolia",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chain: string }> }
) {
  const { chain: chainId } = await params;
  const network = ALCHEMY_NETWORKS[chainId];
  const alchemyKey = process.env.ALCHEMY_KEY;

  if (!network) {
    return NextResponse.json({ error: "Unsupported chain" }, { status: 404 });
  }

  if (!alchemyKey) {
    return NextResponse.json(
      { error: "RPC not configured — set ALCHEMY_KEY on the server" },
      { status: 503 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://${network}.g.alchemy.com/v2/${alchemyKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }
    );
  } catch {
    return NextResponse.json({ error: "Upstream RPC unreachable" }, { status: 502 });
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
