/**
 * TokenForm.tsx – Dynamic form that changes fields based on the chosen token flavor.
 */
"use client";

import { useState, useId, cloneElement, isValidElement } from "react";
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function set<K extends keyof TokenFormData>(key: K, value: TokenFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  async function handleAiGenerate() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai-describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || "Token",
          symbol: form.symbol || "TKN",
          flavor: TOKEN_FLAVOR_LABELS[form.flavor],
          vibes: "degen meme crypto",
        }),
      });
      const data = (await res.json()) as { description?: string; error?: string };
      if (data.description) {
        set("description", data.description);
      } else {
        setAiError(data.error ?? "No description returned");
      }
    } catch {
      setAiError("Failed to generate description");
    } finally {
      setAiLoading(false);
    }
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
          className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-brand-400"
        >
          <span>🌶 Hot Meta Narratives</span>
          <span className="text-gray-500 text-xs">{showNarratives ? "▲ hide" : "▼ show"}</span>
        </button>
        {showNarratives && (
          <div className="mt-3 rounded-xl border border-dark-border bg-dark-muted/40 p-3">
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
        <label className="block text-sm font-semibold text-gray-200 mb-3">
          Token Flavor
        </label>

        {/* Meta / Trending flavors */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">🔥 Trending Narratives</span>
          <div className="flex-1 h-px bg-dark-border" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
          {FLAVOR_OPTIONS.filter((o) => META_FLAVORS.includes(o.value)).map(({ value, label }) => {
            const isActive = form.flavor === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set("flavor", value)}
                className={`relative rounded-xl border p-3 text-left text-xs transition-all ${
                  isActive
                    ? "border-brand-500/60 bg-brand-500/15 text-brand-300 font-semibold glow-neon"
                    : "border-dark-border bg-dark-card text-gray-400 hover:border-brand-500/30 hover:bg-dark-muted hover:text-gray-200"
                }`}
              >
                {isActive && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                )}
                <p className="leading-snug">{label}</p>
                {TOKEN_FLAVOR_DESCRIPTIONS[value] && (
                  <p className={`mt-1 text-[10px] leading-tight ${isActive ? "text-brand-500" : "text-gray-600"}`}>
                    {TOKEN_FLAVOR_DESCRIPTIONS[value].split(".")[0] || TOKEN_FLAVOR_DESCRIPTIONS[value]}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Classic flavors */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">⚡ Classic Templates</span>
          <div className="flex-1 h-px bg-dark-border" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 mb-3">
          {FLAVOR_OPTIONS.filter((o) => CLASSIC_FLAVORS.includes(o.value)).map(({ value, label }) => {
            const isActive = form.flavor === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set("flavor", value)}
                className={`relative rounded-xl border p-2.5 text-left text-xs transition-all ${
                  isActive
                    ? "border-brand-500/60 bg-brand-500/15 text-brand-300 font-semibold glow-neon"
                    : "border-dark-border bg-dark-card text-gray-400 hover:border-brand-500/30 hover:bg-dark-muted hover:text-gray-200"
                }`}
              >
                {isActive && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
                )}
                <p className="leading-snug truncate">{label}</p>
              </button>
            );
          })}
        </div>

        {/* Selected description */}
        {TOKEN_FLAVOR_DESCRIPTIONS[form.flavor] && (
          <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-brand-400/80 italic">
            {TOKEN_FLAVOR_DESCRIPTIONS[form.flavor]}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <TrustBadge>✅ Multi-chain launch path</TrustBadge>
          <TrustBadge>🔒 LP lock tooling built-in</TrustBadge>
          <TrustBadge>⚖️ Fee guardrails enforced</TrustBadge>
          <TrustBadge>🧪 Testnet/Mainnet toggle</TrustBadge>
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
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Use a clear name and a short symbol (max 8 chars). Required fields are marked with an asterisk.
      </p>

      {/* ─── Supply / Decimals ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      {/* ─── Advanced settings ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-dark-border bg-dark-muted/30 p-4 space-y-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-semibold text-gray-200">Advanced Settings</span>
          <span className="text-xs text-gray-500">{showAdvanced ? "▲ hide" : "▼ show"}</span>
        </button>
        {showAdvanced && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="tf-description" className="text-sm font-medium text-gray-200">
                  Description <span className="font-normal text-gray-500">(optional — auto-fills IPFS tab)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiLoading}
                  className="flex items-center gap-1 rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-300 hover:bg-brand-500/20 disabled:opacity-60 transition-colors"
                >
                  {aiLoading ? (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  ) : (
                    "✨"
                  )}
                  AI Generate
                </button>
              </div>
              <textarea
                id="tf-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                placeholder="Describe your token utility / meme narrative"
                className={`${inputCls} resize-none`}
              />
              {aiError && <p className="mt-1 text-xs text-red-400">{aiError}</p>}
            </div>
          </div>
        )}
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
          {form.buyTaxBps + form.sellTaxBps > 1500 && (
            <RiskWarningCard text="High combined buy/sell tax detected. Values above 15% can reduce trust and trading velocity." />
          )}
        </FlavorCard>
      )}

      {/* ─── Deflationary fields ───────────────────────────────────────────── */}
      {isDeflationary && (
        <FlavorCard color="red" title="🔥 Burn Settings">
          <Field label="Burn Rate (bps, 100 = 1%)" hint="Max 500">
            <input type="number" value={form.burnBps} onChange={(e) => set("burnBps", Number(e.target.value))} min={0} max={500} className={inputCls} />
          </Field>
          {form.burnBps > 200 && (
            <RiskWarningCard text="Burn rate above 2% can make transfers feel punitive for holders." />
          )}
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
          <p className="text-sm text-blue-200">
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
          <p className="mt-2 text-xs text-indigo-200">
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
          <p className="mt-2 text-xs text-amber-200">
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
          <p className="mt-2 text-xs text-green-200">
            After deploy, call fundRewardPool() to seed staking rewards. Holders call stake() / unstake() / claimRewards().
          </p>
          {form.teamCapBps > 1500 && (
            <RiskWarningCard text="Team wallet cap above 15% can signal concentration risk. Keep caps conservative for stronger trust." />
          )}
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
          <p className="mt-2 text-xs text-orange-200">
            When ETH reserve hits the threshold, trading pauses 24 h. Call resumeTrading(pairAddress) after adding LP on Uniswap/PancakeSwap to reopen.
          </p>
          {!form.marketingWallet && (
            <RiskWarningCard text="Fee wallet is empty. Set a valid owner/fee wallet before launch to avoid fee-routing mistakes." />
          )}
        </FlavorCard>
      )}

      {(isTaxable || isPumpMigrate) && !form.marketingWallet && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-300">
          ⚠️ Owner/marketing wallet is currently empty. Double-check before deploying.
        </div>
      )}

      {/* ─── Launch fee ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-sm">
        <span className="text-gray-400 font-medium">Launch fee</span>
        <span className="font-black text-brand-300 text-base">{launchFeeDisplay}</span>
      </div>

      {/* ─── Submit ────────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand-500 hover:bg-brand-400 active:bg-brand-600 px-6 py-3 font-black text-black shadow-lg hover:glow-neon focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-bg disabled:opacity-60 transition-all text-sm tracking-wide"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
            Deploying…
          </span>
        ) : (
          "🚀 Deploy Token"
        )}
      </button>
    </form>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "block w-full rounded-lg border border-dark-border bg-dark-card px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

type ColorKey = "yellow" | "red" | "purple" | "blue" | "indigo" | "amber" | "green" | "orange";
const COLOR_MAP: Record<ColorKey, string> = {
  yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-100",
  red:    "border-red-500/30 bg-red-500/10 text-red-100",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
  blue:   "border-blue-500/30 bg-blue-500/10 text-blue-100",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
  amber:  "border-amber-500/30 bg-amber-500/10 text-amber-100",
  green:  "border-green-500/30 bg-green-500/10 text-green-100",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-100",
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
  /** Must be exactly one form element (<input> or <textarea>). */
  children: React.ReactNode;
}) {
  const generatedId = useId();
  // Preserve an existing `id` on the child; fall back to the generated one.
  const childId =
    isValidElement<{ id?: string }>(children) && children.props.id
      ? children.props.id
      : generatedId;

  return (
    <div className={className}>
      <label htmlFor={childId} className="mb-1 block text-sm font-medium text-gray-200">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
        {hint && <span className="ml-2 text-xs text-gray-500">({hint})</span>}
      </label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id: childId })
        : children}
    </div>
  );
}

function TrustBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-dark-border bg-dark-muted px-2.5 py-1 text-gray-300">{children}</span>;
}

function RiskWarningCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
      ⚠️ {text}
    </div>
  );
}
