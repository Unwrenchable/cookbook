/**
 * networkContext.tsx – Shared context for the testnet/mainnet toggle.
 *
 * Consumed by:
 *   - Providers.tsx  → passes isTestnet to SolanaProviders (devnet vs mainnet-beta)
 *   - page.tsx       → reads/writes isTestnet for the UI toggle and SolanaLaunchPanel
 */
"use client";

import { createContext, useContext, useState } from "react";

interface NetworkCtx {
  isTestnet: boolean;
  setIsTestnet: (v: boolean) => void;
}

const NetworkContext = createContext<NetworkCtx>({
  isTestnet: false,
  setIsTestnet: () => {},
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isTestnet, setIsTestnet] = useState(false);
  return (
    <NetworkContext.Provider value={{ isTestnet, setIsTestnet }}>
      {children}
    </NetworkContext.Provider>
  );
}
