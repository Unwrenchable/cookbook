import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TokenForge – Multi-Chain Token Launcher",
  description:
    "Launch custom ERC20 tokens on any EVM chain in under 60 seconds. No code required.",
  keywords: ["token launcher", "ERC20", "DeFi", "multi-chain", "Ethereum", "BSC", "Polygon"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
