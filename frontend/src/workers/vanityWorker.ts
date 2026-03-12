/**
 * vanityWorker.ts – Web Worker that mines EVM vanity addresses.
 *
 * Messages IN  (from main thread):
 *   { type: "start", prefix: string, suffix: string, caseSensitive: boolean }
 *   { type: "stop" }
 *
 * Messages OUT (to main thread):
 *   { type: "attempt", count: number }           – progress update every 5000 attempts
 *   { type: "found",   address, privateKey, attempts, elapsedMs }
 *   { type: "error",   message: string }
 */

import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

let running = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === "stop") {
    running = false;
    return;
  }

  if (msg.type === "start") {
    running = true;
    const { prefix, suffix, caseSensitive } = msg as {
      prefix: string;
      suffix: string;
      caseSensitive: boolean;
    };

    const normalPrefix = caseSensitive ? prefix : prefix.toLowerCase();
    const normalSuffix = caseSensitive ? suffix : suffix.toLowerCase();

    let attempts = 0;
    const startMs = Date.now();

    while (running) {
      const privateKey = generatePrivateKey();
      const address    = privateKeyToAddress(privateKey);

      // Strip the "0x" and normalise case for comparison
      const addrCheck = caseSensitive
        ? address.slice(2)
        : address.slice(2).toLowerCase();

      const prefixMatch = !normalPrefix || addrCheck.startsWith(normalPrefix);
      const suffixMatch = !normalSuffix || addrCheck.endsWith(normalSuffix);

      attempts++;

      if (prefixMatch && suffixMatch) {
        self.postMessage({
          type:       "found",
          address,
          privateKey,
          attempts,
          elapsedMs:  Date.now() - startMs,
        });
        running = false;
        return;
      }

      // Yield progress every 5 000 attempts so the UI can update
      if (attempts % 5_000 === 0) {
        self.postMessage({ type: "attempt", count: attempts });
        // Yield to the event loop so "stop" messages can be processed
        await new Promise((r) => setTimeout(r, 0));
        if (!running) return;
      }
    }
  }
};
