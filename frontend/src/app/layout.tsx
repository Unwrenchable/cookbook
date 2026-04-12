import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { websiteSchema, appSchema } from "@/components/JsonLd";
import { AppShellClient } from "@/components/AppShellClient";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://goonforge.xyz";
const SITE_NAME = "GOONFORGE.XYZ";
const TITLE = "GOONFORGE.XYZ – The Degen Token Launchpad";
const DESCRIPTION =
  "The degen launchpad that prints the next 100x. Launch any ERC-20, meme coin, tax token, reflection token, or AI token on Ethereum, Base, BSC, Arbitrum, Polygon, or Solana in under 60 seconds. Bonding curves, LP locker, renounce, and cross-chain Wormhole bridge in one click.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "token launcher",
    "meme coin launchpad",
    "degen token",
    "ERC20 creator",
    "create token",
    "DeFi launchpad",
    "multi-chain token",
    "Ethereum token",
    "Base token",
    "BSC token",
    "Arbitrum token",
    "Polygon token",
    "Solana token",
    "bonding curve",
    "LP locker",
    "liquidity lock",
    "pump fun alternative",
    "tax token",
    "reflection token",
    "AI token",
    "meme coin",
    "token deploy",
    "cross-chain bridge",
    "Wormhole bridge",
    "vanity address",
    "referral launchpad",
    "no-code token",
    "DeFi tools",
    "Web3 launchpad",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GOONFORGE.XYZ – The Degen Token Launchpad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@goonforge_xyz",
    creator: "@goonforge_xyz",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  category: "technology",
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
        <Script
          id="json-ld-website"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <Script
          id="json-ld-app"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
        />
        <AppShellClient>{children}</AppShellClient>
      </body>
    </html>
  );
}
