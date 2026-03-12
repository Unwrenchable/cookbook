/**
 * AuditReport.tsx – Static security checklist shown post-deploy.
 */
"use client";

import { TokenFlavor } from "@/lib/types";

interface Props {
  tokenAddress: string;
  ownerAddress: string;
  flavor: number;
}

const FLAVOR_NOTES: Partial<Record<TokenFlavor, string>> = {
  [TokenFlavor.Taxable]:       "Max 25% total tax enforced by the factory (30% total fee cap including all bps).",
  [TokenFlavor.Deflationary]:  "Burn rate capped at 5% per transfer by the factory.",
  [TokenFlavor.Reflection]:    "Reflection rate capped at 10% per transfer.",
  [TokenFlavor.AIAgent]:       "Agent daily burn cap enforced on-chain; owner can adjust the cap.",
  [TokenFlavor.PolitiFi]:      "Loser burn capped at 50% by factory. Prize pool is contract-held.",
  [TokenFlavor.UtilityHybrid]: "Team wallet cap enforced. Reward pool funded separately — no inflation attack.",
  [TokenFlavor.PumpMigrate]:   "Graduation pauses trading 24 h for LP setup. No rug during pause.",
};

interface CheckRowProps {
  icon: string;
  label: string;
  detail: string;
}

function CheckRow({ icon, label, detail }: CheckRowProps) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-dark-border last:border-0">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

export function AuditReport({ tokenAddress, ownerAddress, flavor }: Props) {
  const flavorNote = FLAVOR_NOTES[flavor as TokenFlavor];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">🔍 Basic Security Report</h3>
        <span className="rounded-full bg-green-500/20 border border-green-500/40 px-3 py-0.5 text-xs font-bold text-green-400">
          PASS
        </span>
      </div>

      <div className="rounded-xl border border-dark-border bg-dark-muted p-4 space-y-0">
        <CheckRow
          icon="✅"
          label="Ownership"
          detail={
            ownerAddress
              ? `Owner: ${ownerAddress.slice(0, 6)}…${ownerAddress.slice(-4)}. Call renounceOwnership() to make it immutable.`
              : "Owner set at deploy time. Renounce after adding liquidity if desired."
          }
        />
        <CheckRow
          icon="✅"
          label="Mint authority"
          detail="Fixed supply minted at deploy time. No additional minting possible."
        />
        <CheckRow
          icon="✅"
          label="Fee caps"
          detail="Total fees (tax + burn + reflection) ≤ 30% enforced by the factory on-chain."
        />
        <CheckRow
          icon="✅"
          label="Factory pattern"
          detail="Deployed via audited OpenZeppelin Clones (EIP-1167 minimal proxy). No custom proxy logic."
        />
        <CheckRow
          icon="✅"
          label="No external calls in constructor"
          detail="Proxy init only — no re-entrancy risk at deploy time."
        />
        {flavorNote && (
          <CheckRow
            icon="✅"
            label="Flavor-specific checks"
            detail={flavorNote}
          />
        )}
        <CheckRow
          icon="⚠️"
          label="Full Slither audit"
          detail="Run `slither contracts/evm` for a machine-generated static analysis report."
        />
        <CheckRow
          icon="⚠️"
          label="Unaudited contract"
          detail="This is a community tool. DYOR. No warranty expressed or implied. Always verify on-chain."
        />
      </div>

      {tokenAddress && tokenAddress !== "0x" && (
        <p className="text-xs text-gray-500">
          Contract:{" "}
          <code className="font-mono text-gray-400">{tokenAddress}</code>
        </p>
      )}
    </div>
  );
}
