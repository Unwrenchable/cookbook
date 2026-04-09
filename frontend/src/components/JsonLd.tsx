/**
 * JsonLd.tsx – JSON-LD structured data schemas for rich search results.
 *
 * Implements:
 *  • WebSite schema  – enables Google Sitelinks search box
 *  • SoftwareApplication schema – categorizes the dApp for app-related queries
 *
 * These schemas are rendered as <script type="application/ld+json"> tags
 * inside the document <head> in layout.tsx.
 */

const SITE_URL = "https://goonforge.xyz";

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "GOONFORGE.XYZ",
  url: SITE_URL,
  description:
    "The degen launchpad that prints the next 100x. Launch any ERC-20, meme coin, tax token, reflection token, or AI token on Ethereum, Base, BSC, Arbitrum, Polygon, or Solana in under 60 seconds.",
};

export const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GOONFORGE.XYZ",
  url: SITE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Multi-chain no-code token launchpad. Deploy ERC-20 tokens on Ethereum, Base, BSC, Arbitrum, and Polygon with bonding curves, LP locking, tax/reflection/AI flavors, and cross-chain Wormhole bridge in one click.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "ERC-20 token deploy in under 60 seconds",
    "Bonding curve launch",
    "Liquidity locker (anti-rug)",
    "Tax and reflection token flavors",
    "AI-generated token description",
    "Cross-chain Wormhole bridge (Solana → EVM)",
    "Vanity address generator",
    "Referral fee system",
    "Testnet toggle",
  ],
};
