/**
 * TokenForm.tsx – Dynamic form that changes fields based on the chosen token flavor.
 */
"use client";

import { useState } from "react";
import {
  TokenFlavor,
  TOKEN_FLAVOR_LABELS,
  TOKEN_FLAVOR_DESCRIPTIONS,
  DEFAULT_FORM_DATA,
  type TokenFormData,
} from "@/lib/types";
import { NarrativePicker } from "@/components/NarrativePicker";

interface Props {
  onSubmit: (data: TokenFormData) => void;
  isSubmitting?: boolean;
  launchFee?: bigint;
  nativeCurrencySymbol?: string;
  initialFlavor?: TokenFlavor;
}

// Map string name → enum value (used by NarrativePicker)
const FLAVOR_BY_NAME: Record<string, TokenFlavor> = {
  Standard:      TokenFlavor.Standard,
  Taxable:       TokenFlavor.Taxable,
  Deflationary:  TokenFlavor.Deflationary,
  Reflection:    TokenFlavor.Reflection,
  BondingCurve:  TokenFlavor.BondingCurve,
  AIAgent:       TokenFlavor.AIAgent,
  PolitiFi:      TokenFlavor.PolitiFi,
  UtilityHybrid: TokenFlavor.UtilityHybrid,
  PumpMigrate:   TokenFlavor.PumpMigrate,
};

const FLAVOR_OPTIONS = Object.entries(TOKEN_FLAVOR_LABELS).map(([k, v]) => ({
  value: Number(k) as TokenFlavor,
  label: v,
}));

// Flavor groups for the picker
const META_FLAVORS = [TokenFlavor.AIAgent, TokenFlavor.PolitiFi, TokenFlavor.UtilityHybrid, TokenFlavor.PumpMigrate];
const CLASSIC_FLAVORS = [TokenFlavor.Standard, TokenFlavor.Taxable, TokenFlavor.Deflationary, TokenFlavor.Reflection, TokenFlavor.BondingCurve];

export function TokenForm({
  onSubmit,
  isSubmitting,
  launchFee,
  nativeCurrencySymbol = "ETH",
  initialFlavor,
}: Props) {
  const [form, setForm] = useState<TokenFormData>({
    ...DEFAULT_FORM_DATA,
    flavor: initialFlavor ?? TokenFlavor.Standard,
  });
  const [showNarratives, setShowNarratives] = useState(true);

  function set<K extends keyof TokenFormData>(key: K, value: TokenFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  const isTaxable       = form.flavor === TokenFlavor.Taxable;
  const isDeflationary  = form.flavor === TokenFlavor.Deflationary;
  const isReflection    = form.flavor === TokenFlavor.Reflection;
  const isBondingCurve  = form.flavor === TokenFlavor.BondingCurve;
  const isAIAgent       = form.flavor === TokenFlavor.AIAgent;
  const isPolitiFi      = form.flavor === TokenFlavor.PolitiFi;
  const isUtilityHybrid = form.flavor === TokenFlavor.UtilityHybrid;
  const isPumpMigrate   = form.flavor === TokenFlavor.PumpMigrate;
  const hasBondingCurve = isBondingCurve || isPumpMigrate;

  const launchFeeDisplay = launchFee !== undefined
    ? `${(Number(launchFee) / 1e18).toFixed(4)} ${nativeCurrencySymbol}`
    : "—";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ─── Meta Narrative Picker ────────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setShowNarratives((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-brand-700"
        >
          <span>🌶 Hot Meta Narratives</span>
          <span className="text-gray-400 text-xs">{showNarratives ? "▲ hide" : "▼ show"}</span>
        </button>
        {showNarratives && (
          <div className="mt-3">
            <NarrativePicker
              onSelect={(name) => {
                const flavor = FLAVOR_BY_NAME[name];
                if (flavor !== undefined) {
                  set("flavor", flavor);
                  setShowNarratives(false);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Token Flavor ─────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Token Flavor
        </label>
        {/* Meta flavors */}
        <p className="text-xs text-gray-400 mb-1.5">Trending narratives</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
          {FLAVOR_OPTIONS.filter((o) => META_FLAVORS.includes(o.value)).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("flavor", value)}
              className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                form.flavor === value
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Classic flavors */}
        <p className="text-xs text-gray-400 mb-1.5">Classic templates</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {FLAVOR_OPTIONS.filter((o) => CLASSIC_FLAVORS.includes(o.value)).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("flavor", value)}
              className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                form.flavor === value
                  ? "border-brand-500 bg-brand-50 text-brand-700 font-medium"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Selected description */}
        {TOKEN_FLAVOR_DESCRIPTIONS[form.flavor] && (
          <p className="mt-2 text-xs text-gray-500 italic">
            {TOKEN_FLAVOR_DESCRIPTIONS[form.flavor]}
          </p>
        )}
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

        {!hasBondingCurve && (
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
        <FlavorCard color="yellow" title="💰 Tax Settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buy Tax (bps, 100 = 1%)" hint="Max 2500">
              <input type="number" value={form.buyTaxBps} onChange={(e) => set("buyTaxBps", Number(e.target.value))} min={0} max={2500} className={inputCls} />
            </Field>
            <Field label="Sell Tax (bps)" hint="Max 2500">
              <input type="number" value={form.sellTaxBps} onChange={(e) => set("sellTaxBps", Number(e.target.value))} min={0} max={2500} className={inputCls} />
            </Field>
            <Field label="Marketing Wallet" className="sm:col-span-2">
              <input type="text" value={form.marketingWallet} onChange={(e) => set("marketingWallet", e.target.value)} placeholder="0x..." className={inputCls} />
            </Field>
          </div>
        </FlavorCard>
      )}

      {/* ─── Deflationary fields ───────────────────────────────────────────── */}
      {isDeflationary && (
        <FlavorCard color="red" title="🔥 Burn Settings">
          <Field label="Burn Rate (bps, 100 = 1%)" hint="Max 500">
            <input type="number" value={form.burnBps} onChange={(e) => set("burnBps", Number(e.target.value))} min={0} max={500} className={inputCls} />
          </Field>
        </FlavorCard>
      )}

      {/* ─── Reflection fields ─────────────────────────────────────────────── */}
      {isReflection && (
        <FlavorCard color="purple" title="💎 Reflection Settings">
          <Field label="Reflection Rate (bps, 100 = 1%)" hint="Max 1000">
            <input type="number" value={form.reflectionBps} onChange={(e) => set("reflectionBps", Number(e.target.value))} min={0} max={1000} className={inputCls} />
          </Field>
        </FlavorCard>
      )}

      {/* ─── Bonding Curve info ────────────────────────────────────────────── */}
      {isBondingCurve && (
        <FlavorCard color="blue" title="📈 Bonding Curve Token">
          <p className="text-sm text-blue-600">
            Supply starts at 0. Tokens minted on buy, burned on sell. Price increases linearly — pump.fun style.
          </p>
        </FlavorCard>
      )}

      {/* ─── AI Agent fields ───────────────────────────────────────────────── */}
      {isAIAgent && (
        <FlavorCard color="indigo" title="🤖 AI Agent Settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Agent Wallet Address" className="sm:col-span-2" hint="The AI agent's on-chain wallet">
              <input type="text" value={form.agentWallet} onChange={(e) => set("agentWallet", e.target.value)} placeholder="0x... (agent's wallet)" className={inputCls} />
            </Field>
            <Field label="Agent Daily Burn Cap (bps)" hint="Max tokens agent can auto-burn/day. 100 = 1%">
              <input type="number" value={form.agentBurnCapBps} onChange={(e) => set("agentBurnCapBps", Number(e.target.value))} min={0} max={500} className={inputCls} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-indigo-600">
            The agent wallet can call autoBurn(), autoRedistribute(), and postMeme() within the daily cap. Owner can change the cap anytime.
          </p>
        </FlavorCard>
      )}

      {/* ─── PolitiFi fields ───────────────────────────────────────────────── */}
      {isPolitiFi && (
        <FlavorCard color="amber" title="🏛️ PolitiFi / Prediction Market Settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prediction Fee (bps)" hint="% of each transfer → prize pool. 100 = 1%">
              <input type="number" value={form.predictionFeeBps} onChange={(e) => set("predictionFeeBps", Number(e.target.value))} min={0} max={1000} className={inputCls} />
            </Field>
            <Field label="Loser Burn (bps)" hint="% burned from losers' balances on resolution. 2000 = 20%">
              <input type="number" value={form.loserBurnBps} onChange={(e) => set("loserBurnBps", Number(e.target.value))} min={0} max={5000} className={inputCls} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-amber-700">
            After deploy, call setEventMeta() to set the event name + resolution timestamp. Then lockCutoff() and resolve(yesWon) when the event happens.
          </p>
        </FlavorCard>
      )}

      {/* ─── UtilityHybrid fields ──────────────────────────────────────────── */}
      {isUtilityHybrid && (
        <FlavorCard color="green" title="⚙️ Utility Hybrid Settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Staking Reward Rate (bps/day)" hint="APY divided into daily rate. 10 = 0.1%/day ≈ 36.5% APY">
              <input type="number" value={form.rewardRateBps} onChange={(e) => set("rewardRateBps", Number(e.target.value))} min={1} max={500} className={inputCls} />
            </Field>
            <Field label="Auto-Burn on Transfer (bps)" hint="0 = no burn. 50 = 0.5%/transfer">
              <input type="number" value={form.burnBps} onChange={(e) => set("burnBps", Number(e.target.value))} min={0} max={500} className={inputCls} />
            </Field>
            <Field label="Team Wallet Cap (bps)" hint="Max % any single wallet can hold. 500 = 5%">
              <input type="number" value={form.teamCapBps} onChange={(e) => set("teamCapBps", Number(e.target.value))} min={100} max={2000} className={inputCls} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-green-700">
            After deploy, call fundRewardPool() to seed staking rewards. Holders call stake() / unstake() / claimRewards().
          </p>
        </FlavorCard>
      )}

      {/* ─── PumpMigrate fields ────────────────────────────────────────────── */}
      {isPumpMigrate && (
        <FlavorCard color="orange" title="📈 Pump → CEX Graduation Settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Graduation Threshold (ETH)" hint="ETH in bonding curve that triggers graduation">
              <input type="number" value={form.graduationThresholdEth} onChange={(e) => set("graduationThresholdEth", Number(e.target.value))} min={0.001} step={0.001} className={inputCls} />
            </Field>
            <Field label="Trading Fee (bps)" hint="Fee on every buy/sell. 100 = 1%">
              <input type="number" value={form.tradingFeeBps} onChange={(e) => set("tradingFeeBps", Number(e.target.value))} min={0} max={300} className={inputCls} />
            </Field>
            <Field label="Fee Wallet" className="sm:col-span-2" hint="Receives trading fees">
              <input type="text" value={form.marketingWallet} onChange={(e) => set("marketingWallet", e.target.value)} placeholder="0x..." className={inputCls} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-orange-700">
            When ETH reserve hits the threshold, trading pauses 24 h. Call resumeTrading(pairAddress) after adding LP on Uniswap/PancakeSwap to reopen.
          </p>
        </FlavorCard>
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

type ColorKey = "yellow" | "red" | "purple" | "blue" | "indigo" | "amber" | "green" | "orange";
const COLOR_MAP: Record<ColorKey, string> = {
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
  red:    "border-red-200 bg-red-50 text-red-800",
  purple: "border-purple-200 bg-purple-50 text-purple-800",
  blue:   "border-blue-200 bg-blue-50 text-blue-800",
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  amber:  "border-amber-200 bg-amber-50 text-amber-800",
  green:  "border-green-200 bg-green-50 text-green-800",
  orange: "border-orange-200 bg-orange-50 text-orange-800",
};

function FlavorCard({ color, title, children }: { color: ColorKey; title: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 space-y-4 ${COLOR_MAP[color]}`}>
      <h3 className="font-semibold text-sm">{title}</h3>
      {children}
    </div>
  );
}

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
