import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  mainnet,
  sepolia,
  bsc,
  bscTestnet,
  polygon,
  polygonAmoy,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  avalanche,
} from "viem/chains";
import { getTargetByEvmChainId } from "@/lib/crossChain";
import { BURN_BRIDGE_RECEIVER_ABI } from "@/lib/burnBridgeReceiverAbi";

export const runtime = "nodejs";

type RelayRequest = {
  isTestnet: boolean;
  jobs: Array<{
    evmChainId: number;
    payload: `0x${string}`;
  }>;
};

const CHAIN_BY_ID = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [bsc.id]: bsc,
  [bscTestnet.id]: bscTestnet,
  [polygon.id]: polygon,
  [polygonAmoy.id]: polygonAmoy,
  [arbitrum.id]: arbitrum,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [avalanche.id]: avalanche,
} as const;

const ALCHEMY_NETWORKS: Record<number, string> = {
  1: "eth-mainnet",
  11155111: "eth-sepolia",
  137: "polygon-mainnet",
  80002: "polygon-amoy",
  42161: "arb-mainnet",
  421614: "arb-sepolia",
  8453: "base-mainnet",
  84532: "base-sepolia",
};

const PUBLIC_RPC_URLS: Record<number, string> = {
  56: "https://bsc-dataseed.binance.org/",
  97: "https://data-seed-prebsc-1-s1.binance.org:8545",
  43114: "https://api.avax.network/ext/bc/C/rpc",
};

export async function POST(request: NextRequest) {
  const relayerKey =
    process.env.CROSS_CHAIN_RELAYER_PRIVATE_KEY ??
    process.env.RELAYER_PRIVATE_KEY ??
    process.env.PRIVATE_KEY;

  if (!relayerKey) {
    return NextResponse.json(
      { error: "Cross-chain relayer not configured — set CROSS_CHAIN_RELAYER_PRIVATE_KEY on the server" },
      { status: 503 }
    );
  }

  let body: RelayRequest;
  try {
    body = await request.json() as RelayRequest;
  } catch {
    return NextResponse.json({ error: "Invalid relay request body" }, { status: 400 });
  }

  if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
    return NextResponse.json({ error: "Relay request must include at least one job" }, { status: 400 });
  }

  const account = privateKeyToAccount(normalizePrivateKey(relayerKey));

  try {
    const results = await Promise.all(
      body.jobs.map(async (job) => {
        const target = getTargetByEvmChainId(job.evmChainId);
        if (!target || target.isTestnet !== body.isTestnet) {
          return { evmChainId: job.evmChainId, txHash: "", error: "Unsupported relay target" };
        }

        if (!target.receiverAddress || !isAddress(target.receiverAddress)) {
          return { evmChainId: job.evmChainId, txHash: "", error: "Receiver address is not configured" };
        }

        const chain = CHAIN_BY_ID[job.evmChainId as keyof typeof CHAIN_BY_ID];
        if (!chain) {
          return { evmChainId: job.evmChainId, txHash: "", error: "Unsupported EVM chain configuration" };
        }

        const rpcUrl = getRpcUrl(job.evmChainId);
        if (!rpcUrl) {
          return { evmChainId: job.evmChainId, txHash: "", error: "No RPC URL configured for target chain" };
        }

        const transport = http(rpcUrl);
        const publicClient = createPublicClient({ chain, transport });
        const walletClient = createWalletClient({ account, chain, transport });

        const isTrusted = await publicClient.readContract({
          address: target.receiverAddress,
          abi: BURN_BRIDGE_RECEIVER_ABI,
          functionName: "isTrustedRelayer",
          args: [account.address],
        });

        if (!isTrusted) {
          return {
            evmChainId: job.evmChainId,
            txHash: "",
            error: `Relayer ${account.address} is not trusted by ${target.name}`,
          };
        }

        const txHash = await walletClient.writeContract({
          address: target.receiverAddress,
          abi: BURN_BRIDGE_RECEIVER_ABI,
          functionName: "receiveRelayedMessage",
          args: [job.payload, keccak256(job.payload)],
          account,
          chain,
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash });

        return { evmChainId: job.evmChainId, txHash };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Relay failed" },
      { status: 500 }
    );
  }
}

function normalizePrivateKey(value: string): `0x${string}` {
  return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
}

function getRpcUrl(chainId: number): string | null {
  const envOverride = process.env[`EVM_RPC_${chainId}`];
  if (envOverride) {
    return envOverride;
  }

  const alchemyNetwork = ALCHEMY_NETWORKS[chainId];
  if (alchemyNetwork) {
    const alchemyKey = process.env.ALCHEMY_KEY ?? process.env.ALCHEMY_API_KEY;
    if (!alchemyKey) {
      return null;
    }
    return `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`;
  }

  return PUBLIC_RPC_URLS[chainId] ?? null;
}
