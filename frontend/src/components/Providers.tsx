/**
 * Providers.tsx – Client-side wagmi + RainbowKit + React Query + Solana wallet providers.
 */
"use client";

import dynamic from "next/dynamic";
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmiConfig";
import { NetworkProvider, useNetwork } from "@/lib/networkContext";
import "@rainbow-me/rainbowkit/styles.css";

const SolanaProviders = dynamic(
  () => import("@/components/SolanaProviders").then((m) => m.SolanaProviders),
  { ssr: false }
);

const queryClient = new QueryClient();

// Inner component reads from NetworkContext (must be a child of NetworkProvider)
function InnerProviders({ children }: { children: React.ReactNode }) {
  const { isTestnet } = useNetwork();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#84cc16", accentColorForeground: "#000" })}>
          <SolanaProviders isTestnet={isTestnet}>{children}</SolanaProviders>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NetworkProvider>
      <InnerProviders>{children}</InnerProviders>
    </NetworkProvider>
  );
}
