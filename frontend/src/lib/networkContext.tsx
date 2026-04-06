/**
 * networkContext.tsx – Shared context for the testnet/mainnet toggle.
 *
 * Consumed by:
 *   - Providers.tsx  → passes isTestnet to SolanaProviders (devnet vs mainnet-beta)
 *   - page.tsx       → reads/writes isTestnet for the UI toggle and SolanaLaunchPanel
 *
 * Initial state is controlled by NEXT_PUBLIC_IS_TESTNET env var:
 *   "true"  → start in testnet mode  (recommended for local dev)
 *   "false" → start in mainnet mode  (default for production)
 */
"use client";

import { createContext, useContext, useState } from "react";

interface NetworkCtx {
  isTestnet: boolean;
  setIsTestnet: (v: boolean) => void;
}

/**
 * Read the env var at module load time so the initial state reflects the
 * deployment environment. Falls back to false (mainnet) when unset.
 */
const INITIAL_TESTNET =
  process.env.NEXT_PUBLIC_IS_TESTNET === "true";

const NetworkContext = createContext<NetworkCtx>({
  isTestnet: INITIAL_TESTNET,
  setIsTestnet: () => {},
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isTestnet, setIsTestnet] = useState(INITIAL_TESTNET);
  return (
    <NetworkContext.Provider value={{ isTestnet, setIsTestnet }}>
      {children}
    </NetworkContext.Provider>
  );
}
