/**
 * useDeployToken.ts – Hook that encapsulates the full token deployment flow:
 *   1. Read the launch fee from the factory.
 *   2. Call `createToken` on the factory with the user's params.
 *   3. Wait for the transaction receipt.
 *   4. Parse the TokenCreated event to return the new token address.
 */
"use client";

import { useState, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, parseAbiItem } from "viem";
import { TOKEN_FACTORY_ABI } from "@/lib/tokenFactoryAbi";
import { getChainById } from "@/lib/chains";
import type { TokenFormData } from "@/lib/types";

export type TokenFlavor = 0 | 1 | 2 | 3 | 4; // Standard | Taxable | Deflationary | Reflection | BondingCurve

export interface DeployResult {
  tokenAddress: `0x${string}`;
  txHash: `0x${string}`;
}

export function useDeployToken() {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const chainConfig = getChainById(chainId);

  const factoryAddress = (chainConfig?.factoryAddress as `0x${string}`) || undefined;

  const [isPending,    setIsPending]    = useState(false);
  const [error,        setError]        = useState<Error | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);

  // ─── Read: launch fee ─────────────────────────────────────────────────────
  const { data: launchFee } = useReadContract(
    factoryAddress
      ? {
          address:      factoryAddress,
          abi:          TOKEN_FACTORY_ABI,
          functionName: "launchFee",
        }
      : undefined
  );

  // ─── Write: createToken ───────────────────────────────────────────────────
  const { writeContractAsync } = useWriteContract();

  // ─── Wait for receipt ─────────────────────────────────────────────────────
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // ─── Deploy function ──────────────────────────────────────────────────────
  const deploy = useCallback(
    async (formData: TokenFormData): Promise<DeployResult> => {
      if (!userAddress) throw new Error("Wallet not connected");
      if (!factoryAddress) throw new Error(`No factory deployed on chain ${chainId}`);

      setIsPending(true);
      setError(null);
      setDeployResult(null);

      try {
        const fee = launchFee ?? 0n;

        const hash = await writeContractAsync({
          address:      factoryAddress,
          abi:          TOKEN_FACTORY_ABI,
          functionName: "createToken",
          args: [
            {
              name:            formData.name,
              symbol:          formData.symbol,
              totalSupply:     BigInt(formData.totalSupply),
              decimals:        formData.decimals,
              buyTaxBps:       formData.buyTaxBps,
              sellTaxBps:      formData.sellTaxBps,
              burnBps:         formData.burnBps,
              reflectionBps:   formData.reflectionBps,
              marketingWallet: (formData.marketingWallet as `0x${string}`) || "0x0000000000000000000000000000000000000000",
              liquidityBps:    formData.liquidityBps,
              owner:           userAddress,
              flavor:          formData.flavor as TokenFlavor,
            },
          ],
          value: fee,
        });

        setTxHash(hash);

        // Poll for receipt
        let rec = receipt;
        if (!rec) {
          // Simple polling fallback: wait up to 60 s
          const start = Date.now();
          while (!rec && Date.now() - start < 60_000) {
            await new Promise((r) => setTimeout(r, 2_000));
            rec = receipt;
          }
        }

        // Parse TokenCreated event
        const tokenCreatedAbi = parseAbiItem(
          "event TokenCreated(address indexed tokenAddress, address indexed tokenOwner, uint8 flavor, string name, string symbol, uint256 totalSupply)"
        );
        let tokenAddress: `0x${string}` | undefined;
        if (rec) {
          for (const log of rec.logs) {
            try {
              const decoded = decodeEventLog({ abi: [tokenCreatedAbi], ...log });
              if (decoded.eventName === "TokenCreated") {
                tokenAddress = (decoded.args as any).tokenAddress;
                break;
              }
            } catch {
              // not this log
            }
          }
        }

        const result: DeployResult = {
          tokenAddress: tokenAddress ?? "0x",
          txHash: hash,
        };
        setDeployResult(result);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [userAddress, factoryAddress, chainId, launchFee, writeContractAsync, receipt]
  );

  return {
    deploy,
    isPending,
    error,
    deployResult,
    launchFee,
    factoryAddress,
    isFactoryAvailable: Boolean(factoryAddress),
  };
}
