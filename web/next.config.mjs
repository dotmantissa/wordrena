/** @type {import('next').NextConfig} */
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingRoot: path.join(__dirname, ".."),
  webpack: (config) => {
    // Privy drags in optional Solana and Farcaster bits we never touch.
    const stubs = {
      "@solana/kit": false,
      "@solana/web3.js": false,
      "@solana-program/system": false,
      "@solana-program/token": false,
      "@solana-program/compute-budget": false,
      "@solana/wallet-adapter-base": false,
      "@farcaster/mini-app-solana": false,
    };
    config.resolve.alias = { ...config.resolve.alias, ...stubs };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      lokijs: false,
      encoding: false,
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /virtualMasterPool/ },
    ];
    return config;
  },
};

export default nextConfig;
