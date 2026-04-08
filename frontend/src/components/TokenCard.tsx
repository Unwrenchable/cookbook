/**
 * TokenCard.tsx – Pump.fun-style token discovery card.
 */
"use client";

export interface TokenCardProps {
  symbol: string;
  name?: string;
  chain: string;
  velocity: string;
  isPositive: boolean;
  age: string;
  volume: string;
  traders?: number;
  isGraduating?: boolean;
  graduationPct?: number;
}

const CHAIN_STYLE: Record<string, { badge: string; emoji: string }> = {
  Ethereum: { badge: "badge-eth",   emoji: "Ξ" },
  BSC:      { badge: "badge-bnb",   emoji: "🔶" },
  Polygon:  { badge: "badge-matic", emoji: "💜" },
  Arbitrum: { badge: "badge-arb",   emoji: "🔵" },
  Base:     { badge: "badge-base",  emoji: "⬡" },
  Optimism: { badge: "badge-op",    emoji: "🔴" },
  Avalanche:{ badge: "badge-avax",  emoji: "🔺" },
  Solana:   { badge: "badge-sol",   emoji: "◎" },
};

// Deterministic avatar color from symbol
function getAvatarColor(symbol: string): string {
  const colors = [
    "from-brand-500/40 to-brand-700/20 text-brand-300",
    "from-blue-500/40 to-blue-700/20 text-blue-300",
    "from-purple-500/40 to-purple-700/20 text-purple-300",
    "from-orange-500/40 to-orange-700/20 text-orange-300",
    "from-red-500/40 to-red-700/20 text-red-300",
    "from-yellow-500/40 to-yellow-700/20 text-yellow-300",
  ];
  const idx = symbol.charCodeAt(0) % colors.length;
  return colors[idx];
}

export function TokenCard({
  symbol,
  name,
  chain,
  velocity,
  isPositive,
  age,
  volume,
  traders,
  isGraduating,
  graduationPct,
}: TokenCardProps) {
  const chainMeta = CHAIN_STYLE[chain] ?? { badge: "badge-eth", emoji: "🔗" };
  const avatarColor = getAvatarColor(symbol);
  const ticker = symbol.replace(/^\$/, "").slice(0, 3);

  return (
    <div className="glass-card glass-card-hover rounded-xl p-3 cursor-pointer group">
      {/* Top row */}
      <div className="flex items-start gap-2.5 mb-3">
        {/* Avatar */}
        <div
          className={`h-9 w-9 shrink-0 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-xs font-black`}
        >
          {ticker}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-white text-sm">{symbol}</span>
            {isGraduating && (
              <span className="rounded-full bg-yellow-500/20 border border-yellow-500/40 px-1.5 py-px text-[9px] font-bold text-yellow-400 uppercase tracking-wide">
                🎓 Grad
              </span>
            )}
          </div>
          {name && (
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{name}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${chainMeta.badge}`}
        >
          {chainMeta.emoji} {chain}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-dark-muted/60 px-1 py-1.5">
          <p className={`text-[11px] font-bold ${isPositive ? "text-brand-400" : "text-red-400"}`}>
            {velocity}
          </p>
          <p className="text-[9px] text-gray-600 mt-0.5">velocity</p>
        </div>
        <div className="rounded-lg bg-dark-muted/60 px-1 py-1.5">
          <p className="text-[11px] font-semibold text-white truncate">{volume}</p>
          <p className="text-[9px] text-gray-600 mt-0.5">volume</p>
        </div>
        <div className="rounded-lg bg-dark-muted/60 px-1 py-1.5">
          <p className="text-[11px] font-semibold text-white">{age}</p>
          <p className="text-[9px] text-gray-600 mt-0.5">age</p>
        </div>
      </div>

      {/* Graduation progress */}
      {isGraduating && graduationPct !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-gray-500">Graduation progress</span>
            <span className="text-yellow-400 font-semibold">{graduationPct}%</span>
          </div>
          <div className="h-1 rounded-full bg-dark-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-brand-400 transition-all duration-500"
              style={{ width: `${graduationPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: traders + actions */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-dark-border/50">
        {traders !== undefined ? (
          <span className="text-[10px] text-gray-500">
            👥 {traders.toLocaleString()}
          </span>
        ) : (
          <span />
        )}
        <div className="flex gap-1.5">
          <button
            type="button"
            className="rounded-md border border-dark-border bg-dark-muted px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            View
          </button>
          <button
            type="button"
            className="rounded-md border border-brand-500/40 bg-brand-500/10 px-2 py-1 text-[10px] font-semibold text-brand-400 hover:bg-brand-500/20 hover:border-brand-500/60 transition-colors"
          >
            Trade
          </button>
        </div>
      </div>
    </div>
  );
}
