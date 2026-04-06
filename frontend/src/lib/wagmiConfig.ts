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
  optimism,
  optimismSepolia,
} from "wagmi/chains";

// Fall back to a placeholder so the module always loads without crashing.
// WalletConnect connections will fail until a real project ID is set in .env.local.
// Get one free at https://cloud.walletconnect.com
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "dev_wc_project_id";

// During SSR/prerendering, relative URLs (e.g. "/api/rpc/1") are invalid in
// Node.js fetch. Fall back to http() (chain's built-in public RPC) on the
// server; use the proxy path in the browser to keep ALCHEMY_KEY server-only.
const proxyTransport = (path: string) =>
  typeof window === "undefined" ? http() : http(path);
if (typeof window !== "undefined" && WC_PROJECT_ID === "dev_wc_project_id") {
  console.warn(
    "[GOONFORGE] NEXT_PUBLIC_WC_PROJECT_ID is not set. " +
    "WalletConnect connections will not work. " +
    "Get a free project ID at https://cloud.walletconnect.com and add it to .env.local."
  );
}

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
    optimism,
    // Testnets
    sepolia,
    bscTestnet,
    polygonAmoy,
    arbitrumSepolia,
    baseSepolia,
    optimismSepolia,
  ],
  transports: {
    // Route Alchemy-backed chains through the server-side proxy to keep
    // ALCHEMY_KEY out of the browser bundle.
    [mainnet.id]:          proxyTransport("/api/rpc/1"),
    [sepolia.id]:          proxyTransport("/api/rpc/11155111"),
    [polygon.id]:          proxyTransport("/api/rpc/137"),
    [polygonAmoy.id]:      proxyTransport("/api/rpc/80002"),
    [arbitrum.id]:         proxyTransport("/api/rpc/42161"),
    [arbitrumSepolia.id]:  proxyTransport("/api/rpc/421614"),
    [base.id]:             proxyTransport("/api/rpc/8453"),
    [baseSepolia.id]:      proxyTransport("/api/rpc/84532"),
    [optimism.id]:         proxyTransport("/api/rpc/10"),
    [optimismSepolia.id]:  proxyTransport("/api/rpc/11155420"),
    // Public-RPC chains use direct transports.
    [bsc.id]:             http("https://bsc-dataseed.binance.org/"),
    [bscTestnet.id]:      http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    [avalanche.id]:       http("https://api.avax.network/ext/bc/C/rpc"),
  },
  ssr: true,
});
