import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GOONFORGE.XYZ – The Degen Token Launchpad",
  description:
    "The degen launchpad that prints the next 100x. Launch any meme, any chain, any flavor in under 60 seconds. Testnet toggle. Bonding curves. Tax/Reflection/AI tokens. Renounce + lock + liquidity add in one click.",
  keywords: [
    "token launcher", "meme coin", "degen", "ERC20", "DeFi", "multi-chain",
    "Ethereum", "BSC", "Solana", "bonding curve", "LP locker", "pump fun",
  ],
  openGraph: {
    title: "GOONFORGE.XYZ – The Degen Token Launchpad",
    description: "Launch any meme, any chain, any flavor in under 60 seconds.",
    url: "https://goonforge.xyz",
    siteName: "GOONFORGE",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
