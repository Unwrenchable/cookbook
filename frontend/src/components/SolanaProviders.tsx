/**
 * SolanaProviders.tsx – Solana wallet-adapter providers for Phantom and other wallets.
 *
 * Wraps children with:
 *   - ConnectionProvider  → manages the Solana RPC connection
 *   - WalletProvider      → manages wallet state (connected, publicKey, signTransaction…)
 *   - WalletModalProvider → renders the "select wallet" modal on demand
 */
"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Import wallet adapter default styles (modal, button, etc.)
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: React.ReactNode;
  /** Use devnet endpoint when true, mainnet-beta otherwise */
  isTestnet?: boolean;
}

export function SolanaProviders({ children, isTestnet = false }: Props) {
  const endpoint = useMemo(
    () => clusterApiUrl(isTestnet ? "devnet" : "mainnet-beta"),
    [isTestnet]
  );

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
