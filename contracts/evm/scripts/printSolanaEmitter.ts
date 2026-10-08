/**
 * Print the token-burn-bridge program id and its Wormhole emitter PDA.
 * The secret half of a keypair file is wiped after the public key is read and is never printed.
 *
 *   pnpm emitter <programIdBase58>
 *   pnpm emitter -- --keypair <path-to-keypair.json>
 *   pnpm emitter <path-to-keypair.json>
 */
import { existsSync, readFileSync } from "fs";
import { isAbsolute, resolve } from "path";
import { PublicKey } from "@solana/web3.js";
import { emitterPda, pubkeyToHex } from "./mainnetGuard";

function publicKeyFromKeypairFile(filePath: string): PublicKey {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    throw new Error("Could not read the keypair file. Its contents were not printed.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Keypair file is not JSON. Its contents were not printed.");
  }
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error("Keypair file must be a JSON array of 64 bytes. Its contents were not printed.");
  }
  const bytes = new Uint8Array(64);
  try {
    for (let i = 0; i < 64; i++) {
      const n = parsed[i];
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 255) {
        throw new Error("Keypair file has a non-byte value. Its contents were not printed.");
      }
      bytes[i] = n;
    }
    return new PublicKey(bytes.subarray(32, 64));
  } finally {
    bytes.fill(0);
  }
}

function programIdFromArgs(argv: string[]): PublicKey {
  const keypairFlag = argv.indexOf("--keypair");
  if (keypairFlag !== -1) {
    const filePath = argv[keypairFlag + 1];
    if (!filePath || filePath.startsWith("-")) {
      throw new Error("Usage: pnpm emitter -- --keypair <path-to-keypair.json>");
    }
    return publicKeyFromKeypairFile(isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath));
  }
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  if (positional.length !== 1) {
    throw new Error(
      "Usage: pnpm emitter <programIdBase58> | pnpm emitter -- --keypair <path-to-keypair.json>"
    );
  }
  const arg = positional[0];
  const asPath = isAbsolute(arg) ? arg : resolve(process.cwd(), arg);
  if (existsSync(asPath)) {
    return publicKeyFromKeypairFile(asPath);
  }
  return new PublicKey(arg);
}

function main(): void {
  const programId = programIdFromArgs(process.argv.slice(2));
  const pda = emitterPda(programId.toBase58());
  process.stdout.write(
    [
      `programId: ${programId.toBase58()}`,
      `emitterPda: ${pda.toBase58()}`,
      `SOLANA_EMITTER=${pubkeyToHex(pda)}`,
      "",
    ].join("\n")
  );
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : "Failed to derive the emitter PDA.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
