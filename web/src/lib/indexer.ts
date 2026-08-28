import "server-only";
import { contracts } from "./addresses";
import {
  createTransactionRecord,
  updateTransactionRecord,
} from "./db";
import {
  ensureWalletFunding,
  readContract,
  submitWrite,
  waitForFinality,
} from "./genlayer";
import { decryptSecret } from "./walletCrypto";
import type {
  Battle,
  Biome,
  Creature,
  Dispute,
  Move,
  PageResult,
  PlayerRecord,
} from "./types";

export async function worldSnapshot() {
  const [
    bestiaryStats,
    arenaStats,
    tribunalStats,
    creatures,
    moves,
    battles,
    disputes,
    biomes,
  ] = await Promise.all([
    readContract<{ creatures: number; moves: number; total_forged: number }>(
      contracts.bestiary,
      "bestiary_stats"
    ),
    readContract<{ battles: number; biomes: number }>(
      contracts.arena,
      "arena_stats"
    ),
    readContract<{
      total: number;
      upheld: number;
      rejected: number;
      pending: number;
      treasury: number;
    }>(contracts.tribunal, "tribunal_stats"),
    readContract<PageResult<Creature>>(contracts.bestiary, "list_creatures", [
      0,
      24,
    ]),
    readContract<PageResult<Move>>(contracts.bestiary, "list_moves", [0, 24]),
    readContract<PageResult<Battle>>(contracts.arena, "list_battles", [0, 16]),
    readContract<PageResult<Dispute>>(contracts.tribunal, "list_disputes", [
      0,
      16,
    ]),
    readContract<Biome[]>(contracts.arena, "list_biomes"),
  ]);

  return {
    stats: { bestiary: bestiaryStats, arena: arenaStats, tribunal: tribunalStats },
    creatures: creatures.items,
    moves: moves.items,
    battles: battles.items,
    disputes: disputes.items,
    biomes,
  };
}

export async function rosterSnapshot(wallet: string) {
  const creatures = await readContract<Creature[]>(
    contracts.bestiary,
    "list_creatures_by_owner",
    [wallet]
  );
  const moveSets = await Promise.all(
    creatures.map((creature) =>
      readContract<Move[]>(contracts.bestiary, "get_creature_moves", [
        creature.creature_id,
      ])
    )
  );
  return creatures.map((creature, index) => ({
    ...creature,
    moves: moveSets[index],
  }));
}

export async function relayWrite({
  player,
  action,
  contractName,
  methodName,
  args,
  value = 0n,
}: {
  player: PlayerRecord;
  action: string;
  contractName: keyof typeof contracts;
  methodName: string;
  args: Array<string | number | bigint | boolean>;
  value?: bigint;
}) {
  const record = await createTransactionRecord({
    userId: player.id,
    action,
    contractName,
    methodName,
    args,
  });
  let hash: `0x${string}` | undefined;
  try {
    await ensureWalletFunding(player.walletAddress);
    hash = await submitWrite({
      privateKey: decryptSecret(player.encryptedPrivateKey),
      contract: contracts[contractName] as `0x${string}`,
      functionName: methodName,
      args,
      value,
    });
    await updateTransactionRecord(record.id, {
      txHash: hash,
      status: "submitted",
    });
    await waitForFinality(hash);
    await updateTransactionRecord(record.id, {
      txHash: hash,
      status: "finalized",
    });
    return { hash, status: "finalized" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The transaction failed";
    await updateTransactionRecord(record.id, {
      txHash: hash,
      status: "failed",
      error: message,
    });
    throw error;
  }
}
