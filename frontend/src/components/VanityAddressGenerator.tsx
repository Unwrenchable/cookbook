/**
 * VanityAddressGenerator.tsx – Mine a custom EVM address (e.g. 0xcaps..., 0xf122...)
 *
 * The generator runs entirely in a Web Worker — no keys ever leave the browser.
 * Users type a desired prefix/suffix, optionally use the leet-mode suggester for
 * non-hex words (e.g. "fizz" → "f122", "caps" → "ca95"), then mine.
 */
"use client";

import { useState } from "react";
import {
  useVanityGenerator,
  isValidHexPattern,
  leetToHex,
  estimatedAttempts,
  estimatedTime,
} from "@/hooks/useVanityGenerator";

// ─── Popular vanity presets ───────────────────────────────────────────────────

const PRESETS = [
  { label: "0xcafe…",  prefix: "cafe",  suffix: "" },
  { label: "0xdead…",  prefix: "dead",  suffix: "" },
  { label: "0xbeef…",  prefix: "beef",  suffix: "" },
  { label: "0xface…",  prefix: "face",  suffix: "" },
  { label: "0xf122…",  prefix: "f122",  suffix: "",  note: '"fizz" in leet hex' },
  { label: "0xca95…",  prefix: "ca95",  suffix: "",  note: '"caps" in leet hex' },
  { label: "…000",     prefix: "",      suffix: "000" },
  { label: "…1337",    prefix: "",      suffix: "1337" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function VanityAddressGenerator() {
  const { state, start, stop, reset } = useVanityGenerator();

  const [prefix,        setPrefix]        = useState("");
  const [suffix,        setSuffix]        = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showKey,       setShowKey]       = useState(false);
  const [copied,        setCopied]        = useState<"addr" | "key" | null>(null);

  // ─── Leet suggestions ───────────────────────────────────────────────────────

  const prefixLeet = !isValidHexPattern(prefix) ? leetToHex(prefix) : null;
  const suffixLeet = !isValidHexPattern(suffix) ? leetToHex(suffix) : null;

  const effectivePrefix = prefix;
  const effectiveSuffix = suffix;

  const prefixOk = isValidHexPattern(effectivePrefix);
  const suffixOk = isValidHexPattern(effectiveSuffix);
  const canStart =
    (effectivePrefix.length > 0 || effectiveSuffix.length > 0) &&
    prefixOk &&
    suffixOk &&
    (effectivePrefix.length + effectiveSuffix.length) <= 8;

  const difficulty  = estimatedAttempts(effectivePrefix, effectiveSuffix);
  const timeEstimate = estimatedTime(effectivePrefix, effectiveSuffix);

  // ─── Copy helper ─────────────────────────────────────────────────────────────

  async function copy(text: string, kind: "addr" | "key") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    start({ prefix: effectivePrefix, suffix: effectiveSuffix, caseSensitive });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ─── Explainer ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
        <p className="font-semibold text-base mb-1">🔮 Vanity Address Generator</p>
        <p className="text-purple-700">
          Mine a custom EVM wallet address — like <code className="font-mono bg-purple-100 px-1 rounded">0xcafe…</code> or
          {" "}<code className="font-mono bg-purple-100 px-1 rounded">0xf122…</code> (&quot;fizz&quot; in leet hex).
          Everything runs in your browser. Your private key <strong>never leaves your device.</strong>
        </p>
        <p className="mt-1 text-xs text-purple-600">⚠️ Save your private key immediately when found. It will not be stored anywhere.</p>
      </div>

      {/* ─── Presets ────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setPrefix(p.prefix);
                setSuffix(p.suffix);
              }}
              title={p.note}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-mono text-gray-700 hover:border-purple-400 hover:text-purple-700 transition-colors"
            >
              {p.label}
              {p.note && <span className="ml-1 text-gray-400 not-italic font-sans">({p.note})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Form ───────────────────────────────────────────────────────── */}
      <form onSubmit={handleStart} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Prefix */}
          <div>
            <label htmlFor="vanity-prefix" className="block text-sm font-medium text-gray-700 mb-1">
              Prefix <span className="text-gray-400 text-xs">(after 0x)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 font-mono text-sm">0x</span>
              <input
                id="vanity-prefix"
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toLowerCase())}
                placeholder="cafe"
                maxLength={8}
                className={`w-full rounded-lg border pl-9 pr-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                  prefix && !prefixOk
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                }`}
              />
            </div>
            {/* Leet suggestion */}
            {prefix && !prefixOk && prefixLeet && (
              <button
                type="button"
                onClick={() => setPrefix(prefixLeet)}
                className="mt-1 text-xs text-purple-600 hover:underline"
              >
                💡 Use leet hex: <code className="font-mono">{prefixLeet}</code> (closest to &quot;{prefix}&quot;)
              </button>
            )}
            {prefix && !prefixOk && !prefixLeet && (
              <p className="mt-1 text-xs text-red-500">
                Contains non-hex characters that can&apos;t be substituted.
                Valid: <code className="font-mono">0-9 a-f</code>
              </p>
            )}
          </div>

          {/* Suffix */}
          <div>
            <label htmlFor="vanity-suffix" className="block text-sm font-medium text-gray-700 mb-1">
              Suffix <span className="text-gray-400 text-xs">(end of address)</span>
            </label>
            <input
              id="vanity-suffix"
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value.toLowerCase())}
              placeholder="1337"
              maxLength={8}
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
                suffix && !suffixOk
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300 focus:border-purple-500 focus:ring-purple-500"
              }`}
            />
            {suffix && !suffixOk && suffixLeet && (
              <button
                type="button"
                onClick={() => setSuffix(suffixLeet)}
                className="mt-1 text-xs text-purple-600 hover:underline"
              >
                💡 Use leet hex: <code className="font-mono">{suffixLeet}</code>
              </button>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-700">Case-sensitive match</span>
          </label>
        </div>

        {/* Difficulty estimate */}
        {(effectivePrefix || effectiveSuffix) && prefixOk && suffixOk && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Expected attempts:</span>
              <span className="font-mono font-semibold text-gray-800">
                {difficulty.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-gray-600">Estimated time:</span>
              <span className={`font-semibold ${
                difficulty > 1e8 ? "text-red-600" :
                difficulty > 1e6 ? "text-orange-600" : "text-green-600"
              }`}>
                {timeEstimate}
              </span>
            </div>
            {(effectivePrefix.length + effectiveSuffix.length) > 6 && (
              <p className="mt-1 text-xs text-orange-600">
                ⚠️ Patterns longer than 6 chars can take hours. Consider using a shorter pattern.
              </p>
            )}
          </div>
        )}

        {/* Preview of what the address will look like */}
        {(effectivePrefix || effectiveSuffix) && prefixOk && suffixOk && (
          <div className="font-mono text-sm text-gray-600">
            Preview:{" "}
            <span className="text-gray-400">0x</span>
            <span className="text-purple-600 font-bold">{effectivePrefix || ""}</span>
            <span className="text-gray-300">{"x".repeat(Math.max(0, 40 - effectivePrefix.length - effectiveSuffix.length))}</span>
            <span className="text-purple-600 font-bold">{effectiveSuffix || ""}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {state.status === "mining" ? (
            <button
              type="button"
              onClick={stop}
              className="flex-1 rounded-xl bg-red-500 px-6 py-3 font-semibold text-white hover:bg-red-600 transition-colors"
            >
              ⏹ Stop Mining
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canStart}
              className="flex-1 rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              🔮 Start Mining
            </button>
          )}
          {state.status !== "idle" && (
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* ─── Progress ───────────────────────────────────────────────────── */}
      {state.status === "mining" && (
        <div className="rounded-xl border border-purple-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">⛏️</span>
            <div>
              <p className="font-semibold text-gray-800">Mining in progress…</p>
              <p className="text-sm text-gray-500">
                {state.attempts.toLocaleString()} addresses checked in{" "}
                {(state.elapsedMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
          {/* Speed display */}
          {state.elapsedMs > 500 && (
            <p className="text-xs text-gray-500">
              Speed:{" "}
              <span className="font-mono font-medium text-gray-700">
                {Math.round((state.attempts / state.elapsedMs) * 1000).toLocaleString()} addr/s
              </span>
            </p>
          )}
          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-500"
              style={{
                width: `${Math.min(99, (state.attempts / estimatedAttempts(effectivePrefix, effectiveSuffix)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Result ─────────────────────────────────────────────────────── */}
      {state.status === "found" && state.result && (
        <div className="rounded-2xl border-2 border-purple-400 bg-purple-50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <p className="text-lg font-bold text-purple-900">Vanity Address Found!</p>
              <p className="text-sm text-purple-700">
                {state.result.attempts.toLocaleString()} attempts in{" "}
                {(state.result.elapsedMs / 1000).toFixed(2)}s
              </p>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address (public – safe to share)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white border border-purple-200 px-3 py-2 text-sm font-mono break-all text-gray-800">
                <span className="text-gray-400">0x</span>
                <span className="text-purple-700 font-bold">{state.result.address.slice(2, 2 + effectivePrefix.length)}</span>
                <span>{state.result.address.slice(2 + effectivePrefix.length, -effectiveSuffix.length || undefined)}</span>
                {effectiveSuffix && (
                  <span className="text-purple-700 font-bold">{state.result.address.slice(-effectiveSuffix.length)}</span>
                )}
              </code>
              <button
                type="button"
                onClick={() => copy(state.result!.address, "addr")}
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:border-purple-400 transition-colors"
              >
                {copied === "addr" ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Private key – hidden by default */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                ⚠️ Private Key (NEVER share this)
              </p>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showKey ? "Hide" : "Reveal"}
              </button>
            </div>
            {showKey ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-mono break-all text-red-800">
                  {state.result.privateKey}
                </code>
                <button
                  type="button"
                  onClick={() => copy(state.result!.privateKey, "key")}
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-600 hover:border-red-400 transition-colors"
                >
                  {copied === "key" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-100 border border-gray-200 px-3 py-2 text-xs text-gray-400 font-mono">
                ████████████████████████████████████████████████████████████████
              </div>
            )}
            <p className="text-xs text-red-600">
              Save this immediately! It will not be stored or recoverable once you leave this page.
            </p>
          </div>

          {/* Next steps */}
          <div className="rounded-lg bg-white border border-purple-200 p-3 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700">Next steps:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Save the private key somewhere secure (password manager)</li>
              <li>Import the private key into MetaMask or your wallet of choice</li>
              <li>Use this address as your token contract owner or marketing wallet in TokenForge</li>
            </ol>
          </div>

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl border border-purple-300 bg-white px-6 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
          >
            Mine another
          </button>
        </div>
      )}

      {/* ─── Stopped state ──────────────────────────────────────────────── */}
      {state.status === "stopped" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Mining stopped after {state.attempts.toLocaleString()} attempts.{" "}
          <button type="button" onClick={reset} className="text-purple-600 hover:underline">Start again</button>
        </div>
      )}

      {/* ─── Error ──────────────────────────────────────────────────────── */}
      {state.status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
          <button type="button" onClick={reset} className="ml-3 underline">Reset</button>
        </div>
      )}
    </div>
  );
}
