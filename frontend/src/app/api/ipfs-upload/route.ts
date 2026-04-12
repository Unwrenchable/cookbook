/**
 * /api/ipfs-upload – Upload token logo + metadata to IPFS via Pinata.
 * Falls back to mock hashes when PINATA_JWT is not set.
 */
import { NextRequest, NextResponse } from "next/server";

const PINATA_BASE = "https://api.pinata.cloud";

/** 5 MB max logo size. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Allowed MIME types for token logos. */
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
/** Allowed file extensions (as a secondary guard). */
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const name = ((formData.get("name") as string | null) ?? "").slice(0, 100);
    const symbol = ((formData.get("symbol") as string | null) ?? "").slice(0, 20);
    const description = ((formData.get("description") as string | null) ?? "").slice(0, 500);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // File type validation
    if (!ALLOWED_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.test(file.name)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PNG, JPEG, GIF, WebP, and SVG are allowed." },
        { status: 400 }
      );
    }

    // File size validation
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 413 }
      );
    }

    const jwt = process.env.PINATA_JWT;

    if (!jwt) {
      // Dev-only mock hashes — NOT valid IPFS CIDs. Set PINATA_JWT for real uploads.
      const seed = `${file.name}-${Date.now()}`;
      const mockBase = seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40).padEnd(40, "0");
      const mockImageHash = `QmImg${mockBase}`;
      const mockMetaHash  = `QmMeta${mockBase}`;
      return NextResponse.json({
        imageHash: mockImageHash,
        metadataHash: mockMetaHash,
        metadataUri: `https://gateway.pinata.cloud/ipfs/${mockMetaHash}`,
      });
    }

    // 1. Upload image file
    const fileFormData = new FormData();
    fileFormData.append("file", file);
    fileFormData.append("pinataMetadata", JSON.stringify({ name: `${symbol || "token"}-logo` }));

    const imageRes = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fileFormData,
    });

    if (!imageRes.ok) {
      const txt = await imageRes.text();
      return NextResponse.json({ error: `Pinata image upload failed: ${txt}` }, { status: 502 });
    }

    const imageData = (await imageRes.json()) as { IpfsHash: string };
    const imageHash = imageData.IpfsHash;

    // 2. Upload metadata JSON
    const metadata = {
      name,
      symbol,
      description,
      image: `ipfs://${imageHash}`,
    };

    const metaRes = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name: `${symbol || "token"}-metadata` },
      }),
    });

    if (!metaRes.ok) {
      const txt = await metaRes.text();
      return NextResponse.json({ error: `Pinata metadata upload failed: ${txt}` }, { status: 502 });
    }

    const metaData = (await metaRes.json()) as { IpfsHash: string };
    const metadataHash = metaData.IpfsHash;

    return NextResponse.json({
      imageHash,
      metadataHash,
      metadataUri: `https://gateway.pinata.cloud/ipfs/${metadataHash}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
