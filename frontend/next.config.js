/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ── Security headers (applied on every response) ──────────────────────────
  // Note: frame-ancestors and similar CSP directives are also set via vercel.json
  // at the CDN edge; these run at the Next.js server layer for non-Vercel envs.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content-Security-Policy for a Web3 dApp:
          // - script-src includes 'unsafe-eval' required by ethers.js / wagmi bundles
          //   and some wallet extension injections.
          // - connect-src allows our own /api/* proxy routes (which forward to Alchemy
          //   server-side), WalletConnect relayer, public Solana/BSC/Avalanche RPCs,
          //   Wormhole Scan API, and Pinata IPFS.
          // - Alchemy RPCs are NOT listed here — the browser calls /api/rpc/* instead.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://ipfs.io https://*.ipfs.io https://cloudflare-ipfs.com https://raw.githubusercontent.com https://token-icons.s3.amazonaws.com",
              "font-src 'self' data:",
              "connect-src 'self'" +
                " https://relay.walletconnect.com" +   // WalletConnect relay
                " https://relay.walletconnect.org" +
                " https://*.walletconnect.com" +
                " https://*.walletconnect.org" +
                " wss://relay.walletconnect.com" +     // WC websocket
                " wss://relay.walletconnect.org" +
                " https://api.mainnet-beta.solana.com" + // Solana public RPC (proxy fallback)
                " https://api.devnet.solana.com" +
                " https://api.wormholescan.io" +       // Wormhole VAA API
                " https://api.pinata.cloud" +          // Pinata IPFS upload
                " https://bsc-dataseed.binance.org" +  // BSC public RPC
                " https://api.avax.network",           // Avalanche public RPC
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // Prevent API routes from being cached
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },

  // ── Image optimisation ────────────────────────────────────────────────────
  // Allow token logos from common sources. Vercel Image Optimization is
  // enabled by default; no extra config needed for on-platform hosting.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "**.ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "token-icons.s3.amazonaws.com" },
    ],
  },
};

module.exports = nextConfig;
