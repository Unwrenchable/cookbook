/**
 * SolanaProviders.tsx – Solana wallet-adapter providers for multi-wallet support.
 *
 * Wraps children with:
 *   - ConnectionProvider  → manages the Solana RPC connection
 *   - WalletProvider      → manages wallet state (connected, publicKey, signTransaction…)
 *   - WalletModalProvider → renders the "select wallet" modal on demand
 *
 * Supported wallets: Solflare, Backpack (xNFT), Coinbase Wallet.
 * Phantom implements the Wallet Standard and is auto-detected by the adapter,
 * so PhantomWalletAdapter is intentionally not added to avoid duplicate registration.
 * The wallet-adapter auto-detects additional injected wallets via the
 * Wallet Standard, so any compliant extension will appear automatically.
 */
"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import {
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
  const endpoint = useMemo(() => {
    if (rpcEndpoint) {
      return rpcEndpoint;
    }
    const network = isTestnet ? "devnet" : "mainnet-beta";
    if (typeof window === "undefined") {
      return process.env.SOLANA_RPC_URL ?? clusterApiUrl(network);
    }
    return new URL(`/api/solana-rpc?network=${network}`, window.location.origin).toString();
  }, [isTestnet, rpcEndpoint]);

  // Register explicit wallet adapters.
  // Phantom and any Wallet Standard-compatible wallet are auto-detected,
  // so PhantomWalletAdapter is intentionally omitted to avoid the
  // "Phantom was registered as a Standard Wallet" duplicate warning.
  const wallets = useMemo(
    () => [
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
