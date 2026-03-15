/**
 * SolanaProviders.tsx – Solana wallet-adapter providers for multi-wallet support.
 *
 * Wraps children with:
 *   - ConnectionProvider  → manages the Solana RPC connection
 *   - WalletProvider      → manages wallet state (connected, publicKey, signTransaction…)
 *   - WalletModalProvider → renders the "select wallet" modal on demand
 *
 * Supported wallets: Phantom, Solflare, Backpack (xNFT), Coinbase Wallet
 * The wallet-adapter auto-detects additional injected wallets via the
 * Wallet Standard, so any compliant extension will appear automatically.
 */
"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";

// Import wallet adapter default styles (modal, button, etc.)
import "@solana/wallet-adapter-react-ui/styles.css";

interface Props {
  children: React.ReactNode;
  /** Use devnet endpoint when true, mainnet-beta otherwise */
  isTestnet?: boolean;
  /** Override the Solana RPC endpoint (falls back to public cluster URL) */
  rpcEndpoint?: string;
}

export function SolanaProviders({ children, isTestnet = false, rpcEndpoint }: Props) {
  const endpoint = useMemo(
    () =>
      rpcEndpoint ??
      `/api/solana-rpc?network=${isTestnet ? "devnet" : "mainnet-beta"}`,
    [isTestnet, rpcEndpoint]
  );

  // Register all supported wallet adapters.
  // Any wallet implementing the Wallet Standard is auto-detected in addition.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new CoinbaseWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* autoConnect: restores the last connected wallet on page reload */}
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
