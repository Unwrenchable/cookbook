/**
 * wagmiConfig.ts – wagmi + RainbowKit configuration for GOONFORGE.XYZ.
 * Uses getDefaultConfig which enables EIP-6963 wallet auto-detection
 * (MetaMask, Coinbase Wallet, Phantom EVM, and any injected wallet
 * are discovered automatically — no manual connector list needed).
 *
 * All Alchemy-backed chains use our server-side /api/rpc/[chain] proxy so
 * the ALCHEMY_KEY is never embedded in the browser bundle.
 */
"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
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
} from "wagmi/chains";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "YOUR_WC_PROJECT_ID";

export const wagmiConfig = getDefaultConfig({
  appName: "GOONFORGE",
  projectId: WC_PROJECT_ID,
  chains: [
    // Mainnets
    mainnet,
    bsc,
    polygon,
    arbitrum,
    base,
    avalanche,
    // Testnets
    sepolia,
    bscTestnet,
    polygonAmoy,
    arbitrumSepolia,
    baseSepolia,
  ],
  transports: {
    // Route Alchemy-backed chains through the server-side proxy to keep
    // ALCHEMY_KEY out of the browser bundle.
    [mainnet.id]:         http("/api/rpc/1"),
    [sepolia.id]:         http("/api/rpc/11155111"),
    [polygon.id]:         http("/api/rpc/137"),
    [polygonAmoy.id]:     http("/api/rpc/80002"),
    [arbitrum.id]:        http("/api/rpc/42161"),
    [arbitrumSepolia.id]: http("/api/rpc/421614"),
    [base.id]:            http("/api/rpc/8453"),
    [baseSepolia.id]:     http("/api/rpc/84532"),
    // Public-RPC chains use direct transports.
    [bsc.id]:             http("https://bsc-dataseed.binance.org/"),
    [bscTestnet.id]:      http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    [avalanche.id]:       http("https://api.avax.network/ext/bc/C/rpc"),
  },
  ssr: true,
});
