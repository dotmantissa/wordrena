import "server-only";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { env, requireServerEnv } from "./env";
import type {
  Address,
  PlayerRecord,
  TransactionRecord,
} from "./types";

declare global {
  var wordrenaPool: Pool | undefined;
  var wordrenaSchemaReady: Promise<void> | undefined;
}

function pool() {
  requireServerEnv("databaseUrl");
  if (!global.wordrenaPool) {
    global.wordrenaPool = new Pool({
      connectionString: env.databaseUrl,
      max: 6,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return global.wordrenaPool;
}

export function ensureSchema() {
  if (!global.wordrenaSchemaReady) {
    global.wordrenaSchemaReady = pool()
      .query(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          privy_id TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          wallet_address TEXT NOT NULL UNIQUE,
          encrypted_private_key TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS transaction_log (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          contract_name TEXT NOT NULL,
          method_name TEXT NOT NULL,
          arguments JSONB NOT NULL DEFAULT '[]'::jsonb,
          tx_hash TEXT,
          status TEXT NOT NULL,
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS transaction_log_user_created_idx
          ON transaction_log(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS transaction_log_hash_idx
          ON transaction_log(tx_hash);
      `)
      .then(() => undefined);
  }
  return global.wordrenaSchemaReady;
}

function player(row: Record<string, unknown>): PlayerRecord {
  return {
    id: String(row.id),
    privyId: String(row.privy_id),
    email: String(row.email),
    walletAddress: String(row.wallet_address) as Address,
    encryptedPrivateKey: String(row.encrypted_private_key),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function transaction(row: Record<string, unknown>): TransactionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    action: String(row.action),
    contractName: String(row.contract_name),
    methodName: String(row.method_name),
    txHash: row.tx_hash ? String(row.tx_hash) : null,
    status: String(row.status) as TransactionRecord["status"],
    error: row.error ? String(row.error) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function getOrCreatePlayer({
  privyId,
  email,
  walletAddress,
  encryptedPrivateKey,
}: {
  privyId: string;
  email: string;
  walletAddress: Address;
  encryptedPrivateKey: string;
}) {
  await ensureSchema();
  const result = await pool().query(
    `
      INSERT INTO players (
        id, privy_id, email, wallet_address, encrypted_private_key
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (privy_id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW()
      RETURNING *
    `,
    [randomUUID(), privyId, email.toLowerCase(), walletAddress, encryptedPrivateKey]
  );
  return player(result.rows[0]);
}

export async function getPlayerById(id: string) {
  await ensureSchema();
  const result = await pool().query("SELECT * FROM players WHERE id = $1", [id]);
  return result.rows[0] ? player(result.rows[0]) : null;
}

export async function withDatabaseClient<T>(
  work: (client: PoolClient) => Promise<T>
) {
  await ensureSchema();
  const client = await pool().connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

export async function createTransactionRecord({
  userId,
  action,
  contractName,
  methodName,
  args,
}: {
  userId: string;
  action: string;
  contractName: string;
  methodName: string;
  args: unknown[];
}) {
  await ensureSchema();
  const id = randomUUID();
  const jsonArgs = JSON.parse(
    JSON.stringify(args, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
  const result = await pool().query(
    `
      INSERT INTO transaction_log (
        id, user_id, action, contract_name, method_name, arguments, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
      RETURNING *
    `,
    [id, userId, action, contractName, methodName, jsonArgs]
  );
  return transaction(result.rows[0]);
}

export async function updateTransactionRecord(
  id: string,
  update: {
    txHash?: string;
    status: TransactionRecord["status"];
    error?: string;
  }
) {
  await ensureSchema();
  const result = await pool().query(
    `
      UPDATE transaction_log
      SET tx_hash = COALESCE($2, tx_hash),
          status = $3,
          error = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, update.txHash ?? null, update.status, update.error ?? null]
  );
  return result.rows[0] ? transaction(result.rows[0]) : null;
}

export async function recentTransactions(userId: string, limit = 12) {
  await ensureSchema();
  const result = await pool().query(
    `
      SELECT * FROM transaction_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, Math.max(1, Math.min(limit, 50))]
  );
  return result.rows.map(transaction);
}
