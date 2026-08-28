#!/usr/bin/env node
/**
 * Wordrena deploy: pushes the three Intelligent Contracts to studionet, wires
 * them together, and seeds the biomes.
 *
 * genlayer-js sends the transactions fine, but the viem HTTP transport it uses
 * trips over WSL dual stack DNS and keep alive. The fix is to force IPv4 on
 * every dns.lookup and disable keep alive on the global agents, both BEFORE
 * genlayer-js is imported.
 */
import dns from "node:dns";
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const origLookup = dns.lookup.bind(dns);
dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return origLookup(hostname, { ...options, family: 4 }, callback);
};
https.globalAgent = new https.Agent({ keepAlive: false, timeout: 60_000 });
http.globalAgent = new http.Agent({ keepAlive: false, timeout: 60_000 });

const { createAccount, createClient, chains } = await import("genlayer-js");
const { CalldataAddress } = await import("genlayer-js/types");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RPC = process.env.STUDIO_RPC || "https://studio.genlayer.com/api";
const KEY = process.env.DEPLOYER_KEY;
if (!KEY) {
  console.error("DEPLOYER_KEY is required (put it in .env)");
  process.exit(1);
}

const CONTRACT_DIR = path.join(ROOT, "contracts");
const OUT_FILE = path.join(__dirname, "addresses.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function encodeArg(value) {
  if (typeof value === "string" && ADDRESS_RE.test(value)) {
    return new CalldataAddress(Uint8Array.from(Buffer.from(value.slice(2), "hex")));
  }
  if (Array.isArray(value)) return value.map(encodeArg);
  return value;
}

async function waitFinalized(client, txId) {
  console.log("  txId:", txId);
  for (let attempt = 0; attempt < 360; attempt++) {
    try {
      const tx = await client.getTransaction({ hash: txId });
      const status = String(tx?.statusName ?? tx?.status ?? "");
      const statusNumber = Number(tx?.status);
      if (tx && (status === "FINALIZED" || statusNumber === 7)) {
        const leader = tx?.consensus_data?.leader_receipt?.[0];
        const execution =
          tx?.txExecutionResultName ??
          tx?.tx_execution_result_name ??
          leader?.execution_result;
        if (execution === "ERROR" || execution === "FINISHED_WITH_ERROR" || execution === 2) {
          throw new Error(
            `tx ${txId} finalized with execution error: ${JSON.stringify(
              leader?.genvm_result ?? leader ?? tx
            ).slice(0, 1200)}`
          );
        }
        console.log(`  ok FINALIZED (${execution || "SUCCESS"})`);
        return tx;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("tx ") &&
        error.message.includes("execution error")
      ) {
        throw error;
      }
      // transient RPC hiccups, keep polling
    }
    await sleep(5_000);
  }
  throw new Error(`timed out waiting for finality on ${txId}`);
}

async function main() {
  const account = createAccount(KEY);
  console.log("deployer:", account.address);

  const client = createClient({ chain: chains.studionet, account, endpoint: RPC });
  const balance = await client.getBalance({ address: account.address });
  console.log("balance:", balance.toString());

  const addresses = {};

  async function deploy(file, args = []) {
    const code = fs.readFileSync(path.join(CONTRACT_DIR, file), "utf8");
    console.log(`\n> deploying ${file} ...`);
    const txId = await client.deployContract({ code, args: args.map(encodeArg) });
    const finalTx = await waitFinalized(client, txId);
    const addr = finalTx?.to_address ?? finalTx?.data?.contract_address;
    if (!addr) {
      console.error("final tx:", JSON.stringify(finalTx, null, 2).slice(0, 600));
      throw new Error(`no contract address for ${file}`);
    }
    console.log(`  ok ${file} -> ${addr}`);
    await sleep(2_000);
    return addr;
  }

  async function wire(contract, fnName, args, value = 0n) {
    console.log(`\n> ${fnName}(...) on ${contract} ...`);
    const txId = await client.writeContract({
      address: contract,
      functionName: fnName,
      args: args.map(encodeArg),
      value,
    });
    await waitFinalized(client, txId);
    console.log("  ok done");
  }

  addresses.bestiary = await deploy("Bestiary.py");
  addresses.arena = await deploy("Arena.py", [addresses.bestiary]);
  addresses.tribunal = await deploy("Tribunal.py", [addresses.bestiary]);

  await wire(addresses.bestiary, "set_arena", [addresses.arena]);
  await wire(addresses.bestiary, "set_tribunal", [addresses.tribunal]);
  await wire(addresses.arena, "seed_biomes", []);

  // best effort: pull live weather into each biome so the arena breathes on
  // day one. If the oracle is unreachable the contract already falls back to a
  // neutral floor, and the app can refresh any biome later.
  const BIOMES = ["emberpeak", "frostmarch", "galecrest", "verdant", "duskmoor", "sunspire"];
  for (const key of BIOMES) {
    try {
      await wire(addresses.arena, "refresh_biome", [key]);
    } catch (e) {
      console.warn(`  (skipped ${key} refresh: ${e.message ?? e})`);
    }
  }

  addresses.network = "studionet";
  addresses.chainId = 61999;
  addresses.rpc = RPC;
  addresses.deployer = account.address;
  addresses.deployed_at = new Date().toISOString();

  fs.writeFileSync(OUT_FILE, JSON.stringify(addresses, null, 2));
  console.log(`\nWrote ${OUT_FILE}`);
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((e) => {
  console.error("\nx deployment failed:", e.message ?? e);
  process.exit(1);
});
