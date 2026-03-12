/**
 * wagmiConfig.ts – wagmi + RainbowKit configuration for TokenForge.
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
  appName: "TokenForge",
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
