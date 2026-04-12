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

/**
 * Public fallback RPC URLs used when ALCHEMY_KEY is not configured.
 * These are community/official endpoints with no SLA guarantees:
 *   - Rate limits vary; expect throttling under heavy load.
 *   - Suitable for low-traffic or development deployments.
 * Set ALCHEMY_KEY for production to avoid rate limiting.
 */
const PUBLIC_RPC_FALLBACKS: Record<string, string> = {
  "1":        "https://eth.llamarpc.com",          // LlamaNodes – community, ~150 req/s limit
  "11155111": "https://rpc.sepolia.org",            // Ethereum Foundation – testnet only
  "137":      "https://polygon-rpc.com",            // Polygon Labs – official public endpoint
  "80002":    "https://rpc-amoy.polygon.technology", // Polygon Labs – Amoy testnet
  "42161":    "https://arb1.arbitrum.io/rpc",       // Offchain Labs – official Arbitrum One
  "421614":   "https://sepolia-rollup.arbitrum.io/rpc", // Offchain Labs – Arbitrum Sepolia testnet
  "8453":     "https://mainnet.base.org",           // Coinbase – official Base mainnet
  "84532":    "https://sepolia.base.org",           // Coinbase – Base Sepolia testnet
  "10":       "https://mainnet.optimism.io",        // Optimism Foundation – official mainnet
  "11155420": "https://sepolia.optimism.io",        // Optimism Foundation – Sepolia testnet
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

  // Prefer Alchemy when the key is available; fall back to public RPC otherwise.
  const rpcUrl = alchemyKey
    ? `https://${network}.g.alchemy.com/v2/${alchemyKey}`
    : PUBLIC_RPC_FALLBACKS[chainId];

  if (!rpcUrl) {
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
    upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return NextResponse.json({ error: "Upstream RPC unreachable" }, { status: 502 });
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
