#!/usr/bin/env node
/**
 * Replace legacy cross-contract deployments without discarding the live
 * Bestiary state. The old Arena and Tribunal used an API removed from the
 * pinned GenVM runner, so both contracts must be redeployed together.
 */
import dns from "node:dns";
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const originalLookup = dns.lookup.bind(dns);
dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  return originalLookup(hostname, { ...options, family: 4 }, callback);
};
https.globalAgent = new https.Agent({ keepAlive: false, timeout: 60_000 });
http.globalAgent = new http.Agent({ keepAlive: false, timeout: 60_000 });

const { createAccount, createClient, chains } = await import("genlayer-js");
const { CalldataAddress } = await import("genlayer-js/types");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractDir = path.join(root, "contracts");
const outputFile = path.join(root, "deploy", "addresses.json");
const rpc = process.env.STUDIO_RPC || "https://studio.genlayer.com/api";
const key = process.env.DEPLOYER_KEY;
const bestiary = process.env.BESTIARY_ADDRESS;

if (!key || !bestiary) {
  throw new Error("DEPLOYER_KEY and BESTIARY_ADDRESS are required");
}

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
if (!addressPattern.test(bestiary)) {
  throw new Error("BESTIARY_ADDRESS is not a valid contract address");
}

function encodeArg(value) {
  if (typeof value === "string" && addressPattern.test(value)) {
    return new CalldataAddress(
      Uint8Array.from(Buffer.from(value.slice(2), "hex"))
    );
  }
  return value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFinalized(client, txId) {
  console.log("  txId:", txId);
  for (let attempt = 0; attempt < 360; attempt += 1) {
    try {
      const tx = await client.getTransaction({ hash: txId });
      const status = String(tx?.statusName ?? tx?.status ?? "");
      if (status === "FINALIZED" || Number(tx?.status) === 7) {
        const leader = tx?.consensus_data?.leader_receipt?.[0];
        const execution =
          tx?.txExecutionResultName ??
          tx?.tx_execution_result_name ??
          leader?.execution_result;
        if (
          execution === "ERROR" ||
          execution === "FINISHED_WITH_ERROR" ||
          execution === 2
        ) {
          throw new Error(
            `transaction execution failed: ${JSON.stringify(
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
        error.message.startsWith("transaction execution failed")
      ) {
        throw error;
      }
    }
    await sleep(5_000);
  }
  throw new Error(`timed out waiting for ${txId}`);
}

async function main() {
  const account = createAccount(key);
  const client = createClient({
    chain: chains.studionet,
    account,
    endpoint: rpc,
  });

  async function deploy(file, args = []) {
    const code = fs.readFileSync(path.join(contractDir, file), "utf8");
    console.log(`\n> deploying ${file}`);
    const txId = await client.deployContract({
      code,
      args: args.map(encodeArg),
    });
    const receipt = await waitFinalized(client, txId);
    const address = receipt?.to_address ?? receipt?.data?.contract_address;
    if (!address) throw new Error(`no address returned for ${file}`);
    console.log(`  address: ${address}`);
    await sleep(2_000);
    return address;
  }

  async function write(address, method, args = []) {
    console.log(`\n> ${method} on ${address}`);
    const txId = await client.writeContract({
      address,
      functionName: method,
      args: args.map(encodeArg),
    });
    await waitFinalized(client, txId);
  }

  const arena = await deploy("Arena.py", [bestiary]);
  const tribunal = await deploy("Tribunal.py", [bestiary]);

  await write(bestiary, "set_arena", [arena]);
  await write(bestiary, "set_tribunal", [tribunal]);
  await write(arena, "seed_biomes");

  const addresses = {
    bestiary,
    arena,
    tribunal,
    network: "studionet",
    chainId: 61999,
    rpc,
    deployer: account.address,
    deployed_at: new Date().toISOString(),
  };
  fs.writeFileSync(outputFile, `${JSON.stringify(addresses, null, 2)}\n`);
  console.log("\nWrote deploy/addresses.json");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error("\nProduction repair failed:", error.message ?? error);
  process.exit(1);
});
