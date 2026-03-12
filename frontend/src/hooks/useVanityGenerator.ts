/**
 * useVanityGenerator.ts – Hook for mining EVM vanity addresses in a Web Worker.
 *
 * The worker generates random private keys and checks if the derived address
 * matches the desired prefix/suffix. All computation is off the main thread.
 *
 * Security: private keys are generated in the browser and NEVER leave the client.
 */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VanityResult {
  address:    string;
  privateKey: string;
  attempts:   number;
  elapsedMs:  number;
}

export interface VanityConfig {
  prefix:        string;
  suffix:        string;
  caseSensitive: boolean;
}

export type VanityStatus = "idle" | "mining" | "found" | "stopped" | "error";

export interface VanityState {
  status:    VanityStatus;
  attempts:  number;
  result:    VanityResult | null;
  error:     string | null;
  elapsedMs: number;
}

// ─── Hex validation helpers ───────────────────────────────────────────────────

const HEX_RE = /^[0-9a-fA-F]*$/;

export function isValidHexPattern(s: string): boolean {
  return HEX_RE.test(s);
}

/** Leet-speak substitutions for non-hex letters → nearest valid hex char */
const LEET_MAP: Record<string, string> = {
  g: "9",   // 9 looks like g
  h: "4",   // generous stretch — h → 4
  i: "1",   // i → 1
  j: "",    // no good sub
  k: "",
  l: "1",   // l → 1
  m: "",
  n: "",
  o: "0",   // o → 0
  p: "9",   // p → 9 (lowercase p flipped)
  q: "0",
  r: "",
  s: "5",   // s → 5
  t: "7",   // t → 7
  u: "",
  v: "",
  w: "",
  x: "",
  y: "",
  z: "2",   // z → 2
};

/**
 * Returns the leet-ified hex version of a word, or null if impossible.
 * Example: "fizz" → "f122", "caps" → "ca95"
 */
export function leetToHex(word: string): string | null {
  let result = "";
  for (const ch of word.toLowerCase()) {
    if (HEX_RE.test(ch)) {
      result += ch;
    } else if (LEET_MAP[ch] !== undefined && LEET_MAP[ch] !== "") {
      result += LEET_MAP[ch];
    } else {
      return null; // cannot represent
    }
  }
  return result || null;
}

/**
 * Estimated average attempts to find a vanity address.
 * For a prefix of N hex chars (case-insensitive): 16^N / 2 (avg)
 */
export function estimatedAttempts(prefix: string, suffix: string): number {
  const len = prefix.length + suffix.length;
  return Math.pow(16, len);
}

/** Human-readable time estimate at ~200k attempts/sec (single worker) */
export function estimatedTime(prefix: string, suffix: string): string {
  const avg      = estimatedAttempts(prefix, suffix) / 2; // average case
  const rate     = 200_000; // conservative estimate
  const seconds  = avg / rate;

  if (seconds < 5)    return "< 5 seconds";
  if (seconds < 60)   return `~${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `~${Math.round(seconds / 3600)} hours`;
  return `~${Math.round(seconds / 86400)} days`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVanityGenerator() {
  const workerRef   = useRef<Worker | null>(null);
  const timerRef    = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const [state, setState] = useState<VanityState>({
    status:   "idle",
    attempts: 0,
    result:   null,
    error:    null,
    elapsedMs: 0,
  });

  // Tick the elapsed clock
  useEffect(() => {
    if (state.status === "mining") {
      timerRef.current = window.setInterval(() => {
        setState((s) => ({
          ...s,
          elapsedMs: Date.now() - startTimeRef.current,
        }));
      }, 250);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = useCallback((config: VanityConfig) => {
    // Terminate any running worker
    workerRef.current?.terminate();

    const worker = new Worker(
      new URL("../workers/vanityWorker", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    startTimeRef.current = Date.now();

    setState({
      status:   "mining",
      attempts: 0,
      result:   null,
      error:    null,
      elapsedMs: 0,
    });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "attempt") {
        setState((s) => ({ ...s, attempts: msg.count }));
      } else if (msg.type === "found") {
        setState({
          status:    "found",
          attempts:  msg.attempts,
          result:    {
            address:    msg.address,
            privateKey: msg.privateKey,
            attempts:   msg.attempts,
            elapsedMs:  msg.elapsedMs,
          },
          error:     null,
          elapsedMs: msg.elapsedMs,
        });
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === "error") {
        setState((s) => ({ ...s, status: "error", error: msg.message }));
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      setState((s) => ({ ...s, status: "error", error: err.message }));
      workerRef.current = null;
    };

    worker.postMessage({ type: "start", ...config });
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ type: "stop" });
    workerRef.current?.terminate();
    workerRef.current = null;
    setState((s) => ({
      ...s,
      status: "stopped",
      elapsedMs: Date.now() - startTimeRef.current,
    }));
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ status: "idle", attempts: 0, result: null, error: null, elapsedMs: 0 });
  }, []);

  return { state, start, stop, reset };
}
