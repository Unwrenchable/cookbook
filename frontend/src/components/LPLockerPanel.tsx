/**
 * LPLockerPanel.tsx – UI for locking and unlocking LP tokens.
 *
 * Locks LP tokens into the on-chain LPLocker contract with a time lock.
 * Users must first approve the locker to spend their LP tokens.
 */
"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { LP_LOCKER_ABI, LP_LOCKER_ADDRESSES, ERC20_APPROVE_ABI } from "@/lib/lpLockerAbi";

// Duration presets in seconds
const DURATION_PRESETS = [
  { label: "7 days",   seconds: 7   * 86400 },
  { label: "30 days",  seconds: 30  * 86400 },
  { label: "90 days",  seconds: 90  * 86400 },
  { label: "6 months", seconds: 183 * 86400 },
  { label: "1 year",   seconds: 365 * 86400 },
];

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatAmount(amount: bigint): string {
  return parseFloat(formatUnits(amount, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

export function LPLockerPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const lockerAddress = LP_LOCKER_ADDRESSES[chainId] as `0x${string}` | undefined;

  const [lpToken,       setLpToken]       = useState("");
  const [amount,        setAmount]        = useState("");
  const [durationSecs,  setDurationSecs]  = useState(DURATION_PRESETS[1].seconds);
  const [activeSubTab,  setActiveSubTab]  = useState<"new" | "my">("new");

  const { writeContractAsync: writeApprove, isPending: isApproving } = useWriteContract();
  const { writeContractAsync: writeLock,    isPending: isLocking    } = useWriteContract();
  const { writeContractAsync: writeUnlock,  isPending: isUnlocking  } = useWriteContract();

  const [lockTx,   setLockTx]   = useState<`0x${string}` | undefined>();
  const [unlockTx, setUnlockTx] = useState<`0x${string}` | undefined>();
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);

  const { isLoading: isConfirmingLock }   = useWaitForTransactionReceipt({ hash: lockTx });
  const { isLoading: isConfirmingUnlock } = useWaitForTransactionReceipt({ hash: unlockTx });

  // Read allowance for the LP token → locker
  const lpTokenAddr = lpToken.startsWith("0x") && lpToken.length === 42
    ? lpToken as `0x${string}`
    : undefined;

  const { data: allowance } = useReadContract(
    isConnected && lpTokenAddr && lockerAddress && lockerAddress !== "0x"
      ? { address: lpTokenAddr, abi: ERC20_APPROVE_ABI, functionName: "allowance", args: [address!, lockerAddress] }
      : undefined
  );

  // Read LP token balance
  const { data: balance } = useReadContract(
    isConnected && lpTokenAddr
      ? { address: lpTokenAddr, abi: ERC20_APPROVE_ABI, functionName: "balanceOf", args: [address!] }
      : undefined
  );

  // Read user's lock IDs
  const { data: lockIds, refetch: refetchLocks } = useReadContract(
    isConnected && address && lockerAddress && lockerAddress !== "0x"
      ? { address: lockerAddress, abi: LP_LOCKER_ABI, functionName: "getLocksByOwner", args: [address] }
      : undefined
  );

  const amountWei = amount ? parseUnits(amount, 18) : 0n;
  const needsApproval = !allowance || allowance < amountWei;

  async function handleApprove() {
    if (!lpTokenAddr || !lockerAddress || lockerAddress === "0x") return;
    setError(null);
    try {
      await writeApprove({
        address: lpTokenAddr,
        abi:     ERC20_APPROVE_ABI,
        functionName: "approve",
        args:    [lockerAddress, maxUint256],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Approval failed");
    }
  }

  async function handleLock() {
    if (!lockerAddress || lockerAddress === "0x" || !lpTokenAddr || !amountWei) return;
    setError(null);
    setSuccess(null);
    const unlockAt = BigInt(Math.floor(Date.now() / 1000) + durationSecs);
    try {
      const tx = await writeLock({
        address: lockerAddress,
        abi:     LP_LOCKER_ABI,
        functionName: "lock",
        args:    [lpTokenAddr, amountWei, unlockAt],
      });
      setLockTx(tx);
      setSuccess("Tokens locked! 🔒");
      setAmount("");
      refetchLocks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lock failed");
    }
  }

  async function handleUnlock(lockId: bigint) {
    if (!lockerAddress || lockerAddress === "0x") return;
    setError(null);
    setSuccess(null);
    try {
      const tx = await writeUnlock({
        address: lockerAddress,
        abi:     LP_LOCKER_ABI,
        functionName: "unlock",
        args:    [lockId],
      });
      setUnlockTx(tx);
      setSuccess("Tokens unlocked! 🎉");
      refetchLocks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unlock failed");
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-dashed border-dark-border p-8 text-center text-sm text-gray-400">
        Connect your wallet to lock LP tokens.
      </div>
    );
  }

  if (!lockerAddress || lockerAddress === "0x") {
    return (
      <div className="rounded-xl border border-dashed border-dark-border p-8 text-center text-sm text-gray-400">
        LPLocker not yet deployed on this chain. Switch to a supported network.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg border border-dark-border bg-dark-card p-1 w-fit">
        {(["new", "my"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveSubTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeSubTab === t
                ? "bg-brand-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "new" ? "🔒 New Lock" : "📋 My Locks"}
          </button>
        ))}
      </div>

      {/* Error / success */}
      {error   && <div className="rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>}
      {success && <div className="rounded-lg border border-brand-500/30 bg-brand-900/20 px-4 py-3 text-sm text-brand-300">{success}</div>}

      {/* ── New Lock ── */}
      {activeSubTab === "new" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">LP Token Address</label>
            <input
              type="text"
              value={lpToken}
              onChange={(e) => setLpToken(e.target.value)}
              placeholder="0x... (your Uniswap / PancakeSwap LP token)"
              className="block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {balance !== undefined && (
              <p className="mt-1 text-xs text-gray-500">
                Balance: {formatAmount(balance)} LP
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Amount to Lock</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                className="block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {balance !== undefined && (
                <button
                  type="button"
                  onClick={() => setAmount(formatUnits(balance, 18))}
                  className="shrink-0 rounded-lg border border-brand-600 px-3 py-2 text-xs font-medium text-brand-400 hover:bg-brand-600/10"
                >
                  MAX
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Lock Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map(({ label, seconds }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDurationSecs(seconds)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    durationSecs === seconds
                      ? "border-brand-500 bg-brand-500/20 text-brand-300"
                      : "border-dark-border text-gray-400 hover:border-brand-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Unlocks on:{" "}
              <span className="text-brand-400 font-mono">
                {new Date(Date.now() + durationSecs * 1000).toLocaleDateString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </span>
            </p>
          </div>

          {needsApproval ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving || !lpTokenAddr}
              className="w-full rounded-xl bg-yellow-600 px-6 py-3 font-semibold text-white hover:bg-yellow-500 disabled:opacity-50 transition-colors"
            >
              {isApproving ? "Approving…" : "1️⃣ Approve LP Token"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLock}
              disabled={isLocking || isConfirmingLock || !amountWei}
              className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors glow-neon"
            >
              {isLocking || isConfirmingLock ? "Locking…" : "🔒 Lock LP Tokens"}
            </button>
          )}
        </div>
      )}

      {/* ── My Locks ── */}
      {activeSubTab === "my" && (
        <div className="space-y-3">
          {!lockIds || lockIds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-dark-border p-6 text-center text-sm text-gray-400">
              No active locks found on this chain.
            </div>
          ) : (
            lockIds.map((id) => (
              <LockRow
                key={id.toString()}
                lockId={id}
                lockerAddress={lockerAddress}
                onUnlock={handleUnlock}
                isUnlocking={isUnlocking || isConfirmingUnlock}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── LockRow ────────────────────────────────────────────────────────────────

function LockRow({
  lockId,
  lockerAddress,
  onUnlock,
  isUnlocking,
}: {
  lockId: bigint;
  lockerAddress: `0x${string}`;
  onUnlock: (id: bigint) => void;
  isUnlocking: boolean;
}) {
  const { data: lk } = useReadContract({
    address:      lockerAddress,
    abi:          LP_LOCKER_ABI,
    functionName: "getLock",
    args:         [lockId],
  });

  if (!lk) return null;

  const now       = BigInt(Math.floor(Date.now() / 1000));
  const isExpired = !lk.withdrawn && now >= lk.unlockAt;
  const remaining = !lk.withdrawn && now < lk.unlockAt
    ? Number(lk.unlockAt - now)
    : 0;

  const daysLeft  = Math.ceil(remaining / 86400);

  return (
    <div className={`rounded-xl border p-4 text-sm space-y-2 ${
      lk.withdrawn ? "border-dark-border opacity-50" :
      isExpired    ? "border-brand-500/50 bg-brand-500/5" :
                     "border-dark-border bg-dark-card"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-mono text-xs text-gray-400">Lock #{lockId.toString()}</span>
          <p className="text-white font-medium">{formatAmount(lk.amount)} LP</p>
          <p className="text-xs text-gray-500 font-mono truncate">{lk.lpToken}</p>
        </div>
        <div className="text-right shrink-0">
          {lk.withdrawn ? (
            <span className="text-xs text-gray-500">Withdrawn</span>
          ) : isExpired ? (
            <button
              type="button"
              onClick={() => onUnlock(lockId)}
              disabled={isUnlocking}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
            >
              {isUnlocking ? "…" : "🔓 Unlock"}
            </button>
          ) : (
            <div className="text-right">
              <span className="text-xs text-yellow-400 font-medium">🔒 {daysLeft}d left</span>
              <p className="text-xs text-gray-500">{formatDate(lk.unlockAt)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
