import "server-only";

// Every server secret and network setting lives here, read once from the
// environment. Nothing in this file is safe to import from a client component.
export const env = {
  studioRpc: process.env.STUDIO_RPC || "https://studio.genlayer.com/api",
  publicRpc:
    process.env.NEXT_PUBLIC_STUDIO_RPC || "https://studio.genlayer.com/api",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 61999),
  deployerKey: process.env.DEPLOYER_KEY || "",
  walletEncryptionKey: process.env.WALLET_ENCRYPTION_KEY || "",
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  privyAppSecret: process.env.PRIVY_APP_SECRET || "",
  databaseUrl: process.env.DATABASE_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  bestiaryAddress: process.env.BESTIARY_ADDRESS || "",
  arenaAddress: process.env.ARENA_ADDRESS || "",
  tribunalAddress: process.env.TRIBUNAL_ADDRESS || "",
};

export function requireServerEnv(...names: (keyof typeof env)[]) {
  const missing = names.filter((n) => !env[n]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
