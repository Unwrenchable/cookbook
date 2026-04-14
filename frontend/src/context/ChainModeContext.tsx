/**
 * ChainModeContext – Global toggle between EVM and Solana wallet/chain mode.
 * When chainMode is "evm", RainbowKit ConnectButton is shown.
 * When chainMode is "solana", Solana WalletMultiButton is shown.
 */
"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type ChainMode = "evm" | "solana";

interface ChainModeContextType {
  chainMode: ChainMode;
  setChainMode: (mode: ChainMode) => void;
}

const STORAGE_KEY = "goonforge_chain_mode";

function isChainMode(value: unknown): value is ChainMode {
  return value === "evm" || value === "solana";
}

const ChainModeContext = createContext<ChainModeContextType | null>(null);

export function ChainModeProvider({ children }: { children: React.ReactNode }) {
  const [chainMode, setChainModeState] = useState<ChainMode>("evm");

  // Restore persisted preference on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isChainMode(stored)) setChainModeState(stored);
    } catch {
      // localStorage unavailable (SSR or private browsing) — use default
    }
  }, []);

  function setChainMode(mode: ChainMode) {
    setChainModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore write failures
    }
  }

  return (
    <ChainModeContext.Provider value={{ chainMode, setChainMode }}>
      {children}
    </ChainModeContext.Provider>
  );
}

export function useChainMode(): ChainModeContextType {
  const ctx = useContext(ChainModeContext);
  if (!ctx) throw new Error("useChainMode must be used within a ChainModeProvider");
  return ctx;
}
