"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";

export function SolanaWalletBtn({ fullWidth = false }: { fullWidth?: boolean }) {
  const { connected } = useWallet();

  return (
    <WalletMultiButton
      style={{
        background: connected ? "rgba(163,230,53,0.1)" : "rgba(124,58,237,0.15)",
        border: `1px solid ${connected ? "rgba(163,230,53,0.3)" : "rgba(124,58,237,0.4)"}`,
        borderRadius: "0.75rem",
        color: connected ? "#a3e635" : "#a78bfa",
        fontSize: "0.75rem",
        fontWeight: 600,
        padding: "0.4rem 0.85rem",
        height: "auto",
        lineHeight: "1.25rem",
        width: fullWidth ? "100%" : undefined,
        minWidth: 0,
        whiteSpace: "nowrap",
      }}
    />
  );
}
