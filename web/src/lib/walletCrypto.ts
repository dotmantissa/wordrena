import "server-only";
import crypto from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Every player gets a custodial wallet the moment they sign in. We never show
// them the key and they never sign anything by hand, so the one thing that
// matters is that the key sits encrypted at rest. AES-256-GCM, one random
// nonce per secret, the auth tag stored alongside so tampering is caught.
const ALGO = "aes-256-gcm";

function keyBytes(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY;
  if (!hex) throw new Error("WALLET_ENCRYPTION_KEY is not configured");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes of hex");
  }
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("malformed secret blob");
  const decipher = crypto.createDecipheriv(
    ALGO,
    keyBytes(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function newWalletKey(): `0x${string}` {
  return generatePrivateKey();
}

export function walletFromKey(key: string) {
  const acct = privateKeyToAccount(key as `0x${string}`);
  return { address: acct.address as string, key };
}
