/**
 * TokenForm.tsx – Dynamic form that changes fields based on the chosen token flavor.
 */
"use client";

import { useState } from "react";
import {
  TokenFlavor,
  TOKEN_FLAVOR_LABELS,
  DEFAULT_FORM_DATA,
  type TokenFormData,
} from "@/lib/types";

interface Props {
  onSubmit: (data: TokenFormData) => void;
  isSubmitting?: boolean;
  launchFee?: bigint;
  nativeCurrencySymbol?: string;
}

const FLAVOR_OPTIONS = Object.entries(TOKEN_FLAVOR_LABELS).map(([k, v]) => ({
  value: Number(k) as TokenFlavor,
  label: v,
}));

export function TokenForm({ onSubmit, isSubmitting, launchFee, nativeCurrencySymbol = "ETH" }: Props) {
  const [form, setForm] = useState<TokenFormData>(DEFAULT_FORM_DATA);

  function set<K extends keyof TokenFormData>(key: K, value: TokenFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  const isTaxable      = form.flavor === TokenFlavor.Taxable;
  const isDeflationary = form.flavor === TokenFlavor.Deflationary;
  const isReflection   = form.flavor === TokenFlavor.Reflection;
  const isBondingCurve = form.flavor === TokenFlavor.BondingCurve;

  const launchFeeDisplay = launchFee !== undefined
    ? `${(Number(launchFee) / 1e18).toFixed(4)} ${nativeCurrencySymbol}`
    : "—";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ─── Token Flavor ─────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Token Flavor
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FLAVOR_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("flavor", value)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                form.flavor === value
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Basic fields ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Token Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. MyAwesomeToken"
            required
            className={inputCls}
          />
        </Field>

        <Field label="Symbol" required>
          <input
            type="text"
            value={form.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
            placeholder="e.g. MAT"
            maxLength={8}
            required
            className={inputCls}
          />
        </Field>

        {!isBondingCurve && (
          <Field label="Total Supply" required>
            <input
              type="number"
              value={form.totalSupply}
              onChange={(e) => set("totalSupply", Number(e.target.value))}
              min={1}
              required
              className={inputCls}
            />
          </Field>
        )}

        <Field label="Decimals">
          <input
            type="number"
            value={form.decimals}
            onChange={(e) => set("decimals", Number(e.target.value))}
            min={0}
            max={18}
            className={inputCls}
          />
        </Field>
      </div>

      {/* ─── Taxable fields ────────────────────────────────────────────────── */}
      {isTaxable && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-4">
          <h3 className="font-semibold text-yellow-800 text-sm">Tax Settings</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buy Tax (basis points, 100 = 1 %)" hint="Max 2500">
              <input
                type="number"
                value={form.buyTaxBps}
                onChange={(e) => set("buyTaxBps", Number(e.target.value))}
                min={0}
                max={2500}
                className={inputCls}
              />
            </Field>
            <Field label="Sell Tax (basis points)" hint="Max 2500">
              <input
                type="number"
                value={form.sellTaxBps}
                onChange={(e) => set("sellTaxBps", Number(e.target.value))}
                min={0}
                max={2500}
                className={inputCls}
              />
            </Field>
            <Field label="Marketing Wallet" className="sm:col-span-2">
              <input
                type="text"
                value={form.marketingWallet}
                onChange={(e) => set("marketingWallet", e.target.value)}
                placeholder="0x..."
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      )}

      {/* ─── Deflationary fields ───────────────────────────────────────────── */}
      {isDeflationary && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-4">
          <h3 className="font-semibold text-red-800 text-sm">Burn Settings</h3>
          <Field label="Burn Rate (basis points, 100 = 1 %)" hint="Max 1000">
            <input
              type="number"
              value={form.burnBps}
              onChange={(e) => set("burnBps", Number(e.target.value))}
              min={0}
              max={1000}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {/* ─── Reflection fields ─────────────────────────────────────────────── */}
      {isReflection && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-4">
          <h3 className="font-semibold text-purple-800 text-sm">Reflection Settings</h3>
          <Field label="Reflection Rate (basis points, 100 = 1 %)" hint="Max 1000">
            <input
              type="number"
              value={form.reflectionBps}
              onChange={(e) => set("reflectionBps", Number(e.target.value))}
              min={0}
              max={1000}
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {/* ─── Bonding Curve info ────────────────────────────────────────────── */}
      {isBondingCurve && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <p className="font-semibold">Bonding Curve Token</p>
          <p className="mt-1 text-blue-600">
            Supply starts at 0. Tokens are minted on buy and burned on sell. Price increases linearly with supply — pump.fun style.
          </p>
        </div>
      )}

      {/* ─── Launch fee ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <span className="text-gray-600">Launch fee</span>
        <span className="font-semibold text-gray-800">{launchFeeDisplay}</span>
      </div>

      {/* ─── Submit ────────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 transition-colors"
      >
        {isSubmitting ? "Deploying…" : "🚀 Deploy Token"}
      </button>
    </form>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {hint && <span className="ml-2 text-xs text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
