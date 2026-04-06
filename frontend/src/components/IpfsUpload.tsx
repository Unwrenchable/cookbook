/**
 * IpfsUpload.tsx – Upload token logo + metadata to IPFS via the /api/ipfs-upload route.
 */
"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface Props {
  tokenName?: string;
  tokenSymbol?: string;
  onUploaded?: (ipfsHash: string, metadataUri: string) => void;
}

export function IpfsUpload({ tokenName = "", tokenSymbol = "", onUploaded }: Props) {
  const [name, setName] = useState(tokenName);
  const [symbol, setSymbol] = useState(tokenSymbol);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageHash: string; metadataHash: string; metadataUri: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function handleUpload() {
    if (!file) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("name", name);
      body.append("symbol", symbol);
      body.append("description", description);

      const res = await fetch("/api/ipfs-upload", { method: "POST", body });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { imageHash: string; metadataHash: string; metadataUri: string };
      setResult(data);
      onUploaded?.(data.metadataHash, data.metadataUri);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  }

  const inputCls =
    "block w-full rounded-lg border border-dark-border bg-dark-muted px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-200">📎 Upload to IPFS</h3>

      {/* Image picker */}
      <div
        onClick={() => fileRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-dark-border bg-dark-muted p-6 hover:border-brand-500 transition-colors"
      >
        {preview ? (
          <Image src={preview} alt="preview" width={96} height={96} className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <span className="text-4xl">🖼️</span>
        )}
        <span className="text-xs text-gray-400">
          {file ? file.name : "Click to select logo image (PNG/GIF/SVG)"}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Metadata fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">Token Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="MyToken" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">Symbol</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="MTK" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Short token description for IPFS metadata…"
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {result ? (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 space-y-2 text-xs text-gray-300">
          <p className="font-semibold text-brand-400">✅ Uploaded to IPFS</p>
          <p>
            <span className="text-gray-500">Image hash: </span>
            <code className="break-all text-white">{result.imageHash}</code>
          </p>
          <p>
            <span className="text-gray-500">Metadata: </span>
            <a
              href={result.metadataUri}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-brand-400 hover:underline"
            >
              {result.metadataUri}
            </a>
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleUpload}
          disabled={isLoading || !file}
          className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {isLoading ? "Uploading…" : "📤 Upload to IPFS"}
        </button>
      )}
    </div>
  );
}
