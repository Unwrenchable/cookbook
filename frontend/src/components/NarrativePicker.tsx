/**
 * NarrativePicker.tsx – "What's the meta right now?" flavor selector.
 *
 * Shows the 4 hot meta narratives prominently with a short pitch,
 * then lets the user click to jump straight to that flavor in the form.
 */
"use client";

interface Narrative {
  emoji:       string;
  label:       string;
  subtitle:    string;
  description: string;
  flavor:      string; // matches TokenFlavor enum string
  hotness:     "🔥🔥🔥" | "🔥🔥" | "🔥";
  badge?:      string;
  examples:    string[];
}

const NARRATIVES: Narrative[] = [
  {
    emoji:       "🤖",
    label:       "AI Agent",
    subtitle:    "Agentic AI — hottest narrative",
    description:
      "Your token has an on-chain AI agent wallet that can auto-burn, redistribute, and post AI-generated memes. AI16Z / $WILL style. The agent acts autonomously within hard-coded safety limits — full transparency.",
    flavor:      "AIAgent",
    hotness:     "🔥🔥🔥",
    badge:       "Trending",
    examples:    ["$WILL", "AI16Z", "DonutAI"],
  },
  {
    emoji:       "🏛️",
    label:       "PolitiFi",
    subtitle:    "Prediction market + headline volatility",
    description:
      "Token tied to a real-world political event (election, vote, ruling). Two sides bet YES/NO — losers get burned, winners split the prize pool. TRUMP / election-season meta. Insane swings on news.",
    flavor:      "PolitiFi",
    hotness:     "🔥🔥🔥",
    badge:       "High Volatility",
    examples:    ["$TRUMP", "$VOTE", "$MAGA"],
  },
  {
    emoji:       "⚙️",
    label:       "Utility Hybrid",
    subtitle:    "Staking + burns + governance (SHIB model)",
    description:
      "Survivors add real utility or die. Built-in staking for daily rewards, auto-burn on every transfer, and a governance system. Enforced team wallet cap — no massive team wallets. Communities demand transparency.",
    flavor:      "UtilityHybrid",
    hotness:     "🔥🔥",
    examples:    ["$SHIB", "$FLOKI", "$BONK"],
  },
  {
    emoji:       "📈",
    label:       "Pump → CEX",
    subtitle:    "Bonding curve → graduation → listing",
    description:
      "Launch on a bonding curve. When ETH reserve hits the graduation threshold, trading pauses 24 h, LP auto-locks, and the token signals CEX readiness. The quiet → loud meta: CEX listing = liquidity explosion.",
    flavor:      "PumpMigrate",
    hotness:     "🔥🔥🔥",
    badge:       "New Pattern",
    examples:    ["pump.fun graduates", "michi", "mother"],
  },
];

interface Props {
  onSelect: (flavor: string) => void;
}

export function NarrativePicker({ onSelect }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-gray-700">🌶 Hot Narratives Right Now</h3>
        <span className="text-xs text-gray-400">click to pre-select</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NARRATIVES.map((n) => (
          <button
            key={n.flavor}
            type="button"
            onClick={() => onSelect(n.flavor)}
            className="group relative rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-brand-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
          >
            {/* Badge */}
            {n.badge && (
              <span className="absolute right-3 top-3 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                {n.badge}
              </span>
            )}

            {/* Header */}
            <div className="flex items-start gap-2 mb-2">
              <span className="text-2xl">{n.emoji}</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-800 group-hover:text-brand-700 transition-colors">
                    {n.label}
                  </span>
                  <span className="text-sm">{n.hotness}</span>
                </div>
                <p className="text-xs text-gray-500">{n.subtitle}</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600 leading-relaxed mb-2">{n.description}</p>

            {/* Examples */}
            <div className="flex flex-wrap gap-1">
              {n.examples.map((ex) => (
                <span
                  key={ex}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600"
                >
                  {ex}
                </span>
              ))}
            </div>

            {/* CTA arrow */}
            <div className="absolute bottom-3 right-3 text-gray-300 group-hover:text-brand-500 transition-colors text-sm">
              →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
