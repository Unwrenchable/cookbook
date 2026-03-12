/**
 * wagmiConfig.ts – wagmi + RainbowKit configuration for GOONFORGE.XYZ.
 * Uses getDefaultConfig which enables EIP-6963 wallet auto-detection
 * (MetaMask, Coinbase Wallet, Phantom EVM, and any injected wallet
 * are discovered automatically — no manual connector list needed).
 */
"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  mainnet,
  sepolia,
  bsc,
  bscTestnet,
  polygon,
  polygonMumbai,
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
    polygonMumbai,
    arbitrumSepolia,
    baseSepolia,
  ],
  ssr: true,
});
