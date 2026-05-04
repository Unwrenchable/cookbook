/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,

  // Skip ESLint during `next build` — the flat-config eslint-config-next@16 +
  // eslint@10 combination produces a "Converting circular structure to JSON"
  // crash when Next.js tries to serialise the react plugin's self-referential
  // config object.  Linting is handled separately via `npm run lint`.
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack(config, { isServer }) {
    // pino optionally requires pino-pretty for pretty-printing logs.  In a
    // browser/Next.js build it is never available (nor needed), but webpack
    // still tries to resolve it and emits a module-not-found warning from
    // @walletconnect/logger → pino → pino-pretty.  Aliasing to false tells
    // webpack to ignore the import entirely.
    config.resolve.alias["pino-pretty"] = false;

    if (isServer) {
      // @walletconnect/keyvaluestorage@1.1.1 imports its browser module (idb.ts)
      // at the top level. That module immediately calls idb-keyval's createStore(),
      // which calls `indexedDB.open()` directly (no typeof guard). In Node.js
      // (SSR / static-generation), `indexedDB` is not a declared global and throws:
      //
      //   ReferenceError: indexedDB is not defined
      //
      // Replacing the package with a no-op stub for server builds prevents the
      // crash. Wallet storage is never needed server-side (connections only happen
      // in the browser), so the stub is behaviourally correct.
      config.resolve.alias["@walletconnect/keyvaluestorage"] = path.resolve(
        __dirname,
        "src/stubs/wc-keyvaluestorage-stub.js"
      );
    }

    return config;
  },

  // ── Security headers (applied on every response) ──────────────────────────
  // Note: frame-ancestors and similar CSP directives are also set via vercel.json
  // at the CDN edge; these run at the Next.js server layer for non-Vercel envs.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
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
          // - script-src omits 'unsafe-eval'; wagmi v2 + viem do not use eval so it
          //   is not required and removing it reduces XSS attack surface.
          // - connect-src allows our own /api/* proxy routes (which forward to Alchemy
          //   server-side), WalletConnect relayer, public Solana/BSC/Avalanche RPCs,
          //   Wormhole Scan API, and Pinata IPFS.
          // - Alchemy RPCs are NOT listed here — the browser calls /api/rpc/* instead.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://ipfs.io https://*.ipfs.io https://cloudflare-ipfs.com https://raw.githubusercontent.com https://token-icons.s3.amazonaws.com",
              "font-src 'self' data: https://fonts.gstatic.com",
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
                " https://api.avax.network" +          // Avalanche public RPC
                " https://api.web3modal.org",          // WalletConnect/AppKit remote config
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
