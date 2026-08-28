#!/usr/bin/env node
/**
 * Wordrena smoke test: drives the live studionet contracts through the whole
 * loop a real player walks. Craft two creatures, forge a plain English move for
 * each (this is the part where the validators read your words and decide what
 * the move is worth), then throw them into a biome and watch who wins.
 *
 * Same WSL dns and keep alive fix as the deployer, applied before genlayer-js
 * loads.
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

const addresses = JSON.parse(
  fs.readFileSync(path.join(ROOT, "deploy", "addresses.json"), "utf8")
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function encodeArg(value) {
  if (typeof value === "string" && ADDRESS_RE.test(value)) {
    return new CalldataAddress(Uint8Array.from(Buffer.from(value.slice(2), "hex")));
  }
  if (Array.isArray(value)) return value.map(encodeArg);
  return value;
}

const account = createAccount(KEY);
const client = createClient({ chain: chains.studionet, account, endpoint: RPC });

async function read(address, fn, args = []) {
  return client.readContract({
    address,
    functionName: fn,
    args: args.map(encodeArg),
  });
}

async function waitFinalized(txId) {
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
            ).slice(0, 900)}`
          );
        }
        return tx;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("tx ")) throw error;
      // transient RPC hiccup, keep polling
    }
    await sleep(5_000);
  }
  throw new Error(`timed out waiting for finality on ${txId}`);
}

async function write(address, fn, args = [], value = 0n) {
  const txId = await client.writeContract({
    address,
    functionName: fn,
    args: args.map(encodeArg),
    value,
  });
  await waitFinalized(txId);
  return txId;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log("Wordrena smoke test");
  console.log("network :", addresses.network, "| chain", addresses.chainId);
  console.log("player  :", account.address);
  console.log("bestiary:", addresses.bestiary);
  console.log("arena   :", addresses.arena, "\n");

  // 1. the world is already breathing: biomes carry live weather
  const biomes = await read(addresses.arena, "list_biomes");
  const withWeather = biomes.filter((b) => Number(b.buff_pct) > 0);
  console.log(`Biomes online: ${biomes.length}, carrying weather: ${withWeather.length}`);
  for (const b of biomes) {
    console.log(
      `  ${String(b.name).padEnd(15)} ${String(b.home_element).padEnd(6)} ` +
        `buff ${b.buff_pct}%  hazard ${b.hazard}  ${b.conditions} [${b.source}]`
    );
  }
  if (biomes.length !== 6) throw new Error("expected 6 biomes");
  console.log("");

  // 2. craft two fighters
  console.log("Crafting two creatures ...");
  await write(addresses.bestiary, "craft_creature", ["Cinderpaw", "ember"]);
  ok("Cinderpaw the ember creature is born");
  await write(addresses.bestiary, "craft_creature", ["Brackish", "tide"]);
  ok("Brackish the tide creature is born");

  const mine = await read(addresses.bestiary, "list_creatures_by_owner", [account.address]);
  if (mine.length < 2) throw new Error("could not read my new creatures back");
  const cinder = mine[mine.length - 2];
  const brack = mine[mine.length - 1];
  console.log(
    `  Cinderpaw ${cinder.creature_id}: ${cinder.hp} hp / ${cinder.attack} atk / ` +
      `${cinder.defense} def / ${cinder.speed} spd (${cinder.archetype})`
  );
  console.log(
    `  Brackish  ${brack.creature_id}: ${brack.hp} hp / ${brack.attack} atk / ` +
      `${brack.defense} def / ${brack.speed} spd (${brack.archetype})\n`
  );

  // 3. forge a plain English move for each: the validators read the words
  console.log("Forging moves from plain English (validators are reading) ...");
  await write(addresses.bestiary, "forge_move", [
    cinder.creature_id,
    "Emberlash Pounce",
    "a searing pounce that grows more vicious the lower my own health falls",
  ]);
  ok("Cinderpaw's move forged");
  await write(addresses.bestiary, "forge_move", [
    brack.creature_id,
    "Undertow Crush",
    "a heavy tidal slam with a small chance to stun the target for a turn",
  ]);
  ok("Brackish's move forged");

  const cinderMoves = await read(addresses.bestiary, "get_creature_moves", [cinder.creature_id]);
  const brackMoves = await read(addresses.bestiary, "get_creature_moves", [brack.creature_id]);
  const m1 = cinderMoves[cinderMoves.length - 1];
  const m2 = brackMoves[brackMoves.length - 1];
  console.log(
    `  "${m1.name}" -> power ${m1.power}, mana ${m1.mana_cost}, cd ${m1.cooldown}, ` +
      `acc ${m1.accuracy}%, effect ${m1.effect_kind}, scaling ${m1.scaling}, budget ${m1.power_budget}`
  );
  console.log(
    `  "${m2.name}" -> power ${m2.power}, mana ${m2.mana_cost}, cd ${m2.cooldown}, ` +
      `acc ${m2.accuracy}%, effect ${m2.effect_kind}, scaling ${m2.scaling}, budget ${m2.power_budget}`
  );
  if (!m1 || !m2 || Number(m1.power) < 0) throw new Error("moves did not forge");
  if (m1.scaling !== "low_hp") console.log("  (note: leader read the scaling as", m1.scaling + ", still a valid reading)");
  console.log("");

  // 4. duel in the ember biome and read the fight back
  console.log("Duelling in Emberpeak ...");
  await write(addresses.arena, "duel", [cinder.creature_id, brack.creature_id, "emberpeak"]);
  const fights = await read(addresses.arena, "battles_for_creature", [cinder.creature_id, 1]);
  if (!fights.length) throw new Error("no battle recorded");
  const fight = fights[0];
  const full = await read(addresses.arena, "get_battle", [fight.battle_id]);
  let log = Array.isArray(full.log) ? full.log : [];
  const winnerName =
    fight.winner_id === fight.attacker_id
      ? fight.attacker_name
      : fight.winner_id === fight.defender_id
        ? fight.defender_name
        : "a draw";
  console.log(`  battle ${fight.battle_id} in Emberpeak (${fight.biome_conditions})`);
  console.log(`  ${fight.attacker_name} vs ${fight.defender_name}`);
  console.log(`  winner: ${winnerName} after ${fight.turns} turns`);
  console.log(`  ${fight.summary}`);
  console.log("  opening exchanges:");
  for (const line of log.slice(0, 6)) {
    console.log(`    - ${typeof line === "string" ? line : JSON.stringify(line)}`);
  }
  console.log("");

  // 5. the record actually moved on both fighters
  const after = await read(addresses.bestiary, "list_creatures_by_owner", [account.address]);
  const cAfter = after.find((c) => c.creature_id === cinder.creature_id);
  const bAfter = after.find((c) => c.creature_id === brack.creature_id);
  console.log(
    `  Cinderpaw now ${cAfter.wins}W ${cAfter.losses}L (level ${cAfter.level}, ${cAfter.xp} xp)`
  );
  console.log(
    `  Brackish  now ${bAfter.wins}W ${bAfter.losses}L (level ${bAfter.level}, ${bAfter.xp} xp)`
  );
  if (cAfter.battles < 1 || bAfter.battles < 1) throw new Error("battle record did not update");

  const aStats = await read(addresses.arena, "arena_stats");
  const bStats = await read(addresses.bestiary, "bestiary_stats");
  console.log(
    `\nArena totals: ${aStats.battles} battles | ` +
      `Bestiary: ${bStats.creatures} creatures, ${bStats.moves} moves forged`
  );

  console.log("\nSMOKE TEST PASSED. The whole loop works on chain.");
}

main().catch((e) => {
  console.error("\nSMOKE TEST FAILED:", e.message ?? e);
  process.exit(1);
});
