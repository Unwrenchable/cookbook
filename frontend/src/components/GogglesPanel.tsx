'use client';

import { useState } from 'react';
import { useAccount, useChainId, useWriteContract, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { getChainById } from '@/lib/chains';
import { useNetwork } from '@/lib/networkContext';

// Minimal ABI for the integrated DomainRegistry (from supreme-goggles)
const DOMAIN_REGISTRY_ABI = [
  {
    inputs: [
      { name: 'domainName', type: 'string' },
      { name: 'extension', type: 'string' },
    ],
    name: 'registerDomain',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'domainName', type: 'string' }],
    name: 'checkAvailability',
    outputs: [{ name: 'available', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    // public state var on contract -> view function with 0 inputs
    inputs: [],
    name: 'registrationFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface GogglesPanelProps {
  isTestnet: boolean;
}

export function GogglesPanel({ isTestnet }: GogglesPanelProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chainConfig = getChainById(chainId);
  const { isTestnet: networkTestnet } = useNetwork();

  const [domainName, setDomainName] = useState('');
  const [extension, setExtension] = useState('.fizz');
  const [customExt, setCustomExt] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'registering' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [registeredDomain, setRegisteredDomain] = useState('');

  // namingContractAddress now comes from the enhanced ChainConfig (populated from NEXT_PUBLIC_NAMING_* envs)
  // See lib/chains.ts and frontend/.env.example for setup.
  // When present the panel performs real checkAvailability + reads registrationFee.
  const namingContractAddress = chainConfig?.namingContractAddress as `0x${string}` | undefined;

  const { writeContractAsync } = useWriteContract();

  const effectiveExtension = useCustom && customExt
    ? (customExt.startsWith('.') ? customExt : `.${customExt}`)
    : extension;

  const fullDomain = `${domainName}${effectiveExtension}`;

  // Real on-chain reads when naming contract is configured for the current chain.
  // These replace the previous demo simulation.
  const hasNamingContract = !!namingContractAddress;

  const { data: onchainRegFee } = useReadContract({
    address: namingContractAddress,
    abi: DOMAIN_REGISTRY_ABI,
    functionName: 'registrationFee',
    query: { enabled: hasNamingContract },
  });

  const { data: onchainAvailable, refetch: refetchAvailability } = useReadContract({
    address: namingContractAddress,
    abi: DOMAIN_REGISTRY_ABI,
    functionName: 'checkAvailability',
    args: [fullDomain],
    query: { enabled: hasNamingContract && !!domainName },
  });

  async function handleCheckAvailability() {
    if (!domainName) return;
    setStatus('checking');
    setMessage('Checking availability on-chain...');

    if (hasNamingContract) {
      try {
        const result = await refetchAvailability();
        const available = result?.data ?? onchainAvailable;
        const full = fullDomain;
        if (available === true) {
          setMessage(`"${full}" is AVAILABLE on-chain.`);
        } else if (available === false) {
          setMessage(`"${full}" is TAKEN.`);
        } else {
          setMessage(`"${full}" check complete (contract responded).`);
        }
      } catch (e: any) {
        setMessage(`On-chain check failed: ${e?.shortMessage || e?.message || 'see console'}`);
      }
    } else {
      const full = fullDomain;
      setMessage(`"${full}" — naming contract not configured for this chain. Deploy DomainRegistry and set NEXT_PUBLIC_NAMING_* in env.`);
    }
    setStatus('idle');
  }

  async function handleRegister() {
    if (!isConnected || !address) {
      setMessage('Connect your wallet first (Phantom / MetaMask supported via Goonforge providers).');
      return;
    }
    if (!namingContractAddress) {
      setMessage('Naming contract not configured for this chain yet. Deploy DomainRegistry.sol (from supreme-goggles) and add the address to your chain config or .env.');
      setStatus('error');
      return;
    }
    if (!domainName) {
      setMessage('Enter a name to register.');
      return;
    }

    const feeFromChain = onchainRegFee ? (onchainRegFee as bigint) : undefined;
    const fee = feeFromChain !== undefined ? feeFromChain : parseEther('0.001');

    setStatus('registering');
    setMessage(`Registering ${fullDomain}... (fee: ${feeFromChain !== undefined ? (Number(feeFromChain) / 1e18).toFixed(6) : '0.001 (placeholder)'} ETH)`);

    try {
      const hash = await writeContractAsync({
        address: namingContractAddress,
        abi: DOMAIN_REGISTRY_ABI,
        functionName: 'registerDomain',
        args: [fullDomain, effectiveExtension],
        value: fee,
      });

      setRegisteredDomain(fullDomain);
      setStatus('success');
      setMessage(`Success! ${fullDomain} is yours forever. Tx: ${hash.slice(0, 10)}... (view on explorer). Add records (IPFS avatar, socials) via the contract.`);

      // Tie-in: after successful Goonforge token launch, this is the natural next step for branding.
    } catch (err: any) {
      setStatus('error');
      setMessage(`Registration failed: ${err?.shortMessage || err?.message || 'Check contract deployment, fees, and network.'}`);
    }
  }

  return (
    <div className="rounded-2xl border border-dark-border bg-dark-card/60 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🕶️</span>
        <div>
          <h3 className="text-xl font-bold">Supreme Goggles — Universal Naming</h3>
          <p className="text-sm text-gray-400">
            Lifetime .fizz, .goon, or ANY custom extension for your launched tokens. Integrated from supreme-goggles.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-gray-500 mb-1 block">Name</label>
          <input
            type="text"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="yourproject or myname"
            className="w-full rounded-xl border border-dark-border bg-black/40 px-4 py-3 text-lg font-mono focus:outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-gray-500 mb-1 block">Extension (TLD)</label>
          <div className="flex gap-2">
            {!useCustom ? (
              <select
                value={extension}
                onChange={(e) => {
                  if (e.target.value === 'custom') setUseCustom(true);
                  else setExtension(e.target.value);
                }}
                className="flex-1 rounded-xl border border-dark-border bg-black/40 px-4 py-3 text-brand-400 font-medium"
              >
                <option value=".fizz">.fizz (Atomic Fizz / Goonforge)</option>
                <option value=".goon">.goon</option>
                <option value=".eth">.eth</option>
                <option value=".sol">.sol</option>
                <option value=".supreme">.supreme</option>
                <option value="custom">✨ Custom .anything</option>
              </select>
            ) : (
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={customExt}
                  onChange={(e) => setCustomExt(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ''))}
                  placeholder=".yourcustom"
                  className="flex-1 rounded-xl border border-emerald-500/50 bg-black/40 px-4 py-3 font-mono"
                />
                <button onClick={() => setUseCustom(false)} className="px-4 rounded-xl border border-dark-border text-xs">Use presets</button>
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Lifetime ownership. Pay once in native gas token. No renewals. Full records (IPFS, socials, avatar).</p>
        </div>

        {/* Live on-chain status (populated when namingContractAddress set for current chain) */}
        {hasNamingContract && domainName && (
          <div className="text-xs rounded-lg border border-dark-border bg-black/30 px-3 py-2 text-gray-400">
            {onchainAvailable === true && <span className="text-emerald-400">✓ Available on-chain</span>}
            {onchainAvailable === false && <span className="text-red-400">✗ Taken on-chain</span>}
            {onchainAvailable === undefined && <span>Checking on-chain availability…</span>}
            {onchainRegFee !== undefined && (
              <span className="ml-3">Fee: {(Number(onchainRegFee) / 1e18).toFixed(6)} native</span>
            )}
          </div>
        )}
        {!hasNamingContract && domainName && (
          <div className="text-[10px] text-amber-400/80">Naming contract not set for this chain — using demo/placeholder fee. Add NEXT_PUBLIC_NAMING_* + redeploy contract to enable full Supreme Goggles.</div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCheckAvailability}
          disabled={!domainName || status === 'checking'}
          className="rounded-xl border border-dark-border px-5 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          Check Availability
        </button>

        <button
          onClick={handleRegister}
          disabled={!isConnected || !domainName || status === 'registering'}
          className="rounded-xl bg-brand-500 px-6 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
        >
          {status === 'registering' ? 'Registering...' : 'Register Domain (lifetime)'}
        </button>

        {registeredDomain && (
          <a
            href={`/fizz/`}
            className="rounded-xl border border-[#ff9933] px-5 py-2 text-sm text-[#ff9933] hover:bg-[#ff9933]/10"
          >
            Back to FIZZ launcher →
          </a>
        )}
      </div>

      {message && (
        <div className={`rounded-xl p-4 text-sm ${status === 'error' ? 'bg-red-500/10 text-red-400' : status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-dark-muted text-gray-300'}`}>
          {message}
          {status === 'success' && registeredDomain && (
            <div className="mt-2 text-xs opacity-70">Next: set records (wallet for your token, IPFS logo from the launch, socials). Transferable forever.</div>
          )}
        </div>
      )}

      <div className="text-[10px] text-gray-500 border-t border-dark-border pt-3">
        Powered by Supreme Goggles (integrated). Deploy DomainRegistry.sol (see contracts/evm/contracts/naming) per chain, set NEXT_PUBLIC_NAMING_* envs, then real on-chain checks + fee apply here. .fizz / .goon domains for the Goonforge + Atomic Fizz ecosystem.
      </div>
    </div>
  );
}
