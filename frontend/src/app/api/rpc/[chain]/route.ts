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

/** Maximum allowed JSON-RPC body size (32 KB). Prevents payload-flooding attacks. */
const MAX_BODY_BYTES = 32 * 1024;

/**
 * Allowlist of JSON-RPC methods the proxy will forward.
 * Restricts the proxy to read-only / standard wallet operations so attackers
 * cannot abuse server-side Alchemy credits with expensive debug/trace calls.
 */
const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getBlockReceipts",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "eth_sendRawTransaction",
  "eth_subscribe",
  "eth_unsubscribe",
  "net_version",
  "web3_clientVersion",
]);

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

  // Enforce body size limit before reading
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
    return NextResponse.json({ error: "Upstream RPC unreachable" }, { status: 502 });
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
