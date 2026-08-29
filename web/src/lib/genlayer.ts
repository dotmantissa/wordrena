import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { env } from "./env";
import type { Address } from "./types";

type CalldataValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | CalldataValue[]
  | { [key: string]: CalldataValue };

let transportPrepared = false;
let sharedPublicClient: Awaited<ReturnType<typeof createPublicClient>> | null =
  null;

function prepareNodeTransport() {
  if (transportPrepared) return;
  transportPrepared = true;

  const originalLookup = dns.lookup.bind(dns);
  dns.lookup = ((hostname: string, options: unknown, callback: unknown) => {
    if (typeof options === "function") {
      return originalLookup(hostname, { family: 4 }, options as never);
    }
    return originalLookup(
      hostname,
      { ...(options as object), family: 4 },
      callback as never
    );
  }) as never;
  https.globalAgent = new https.Agent({ keepAlive: false, timeout: 60_000 });
  http.globalAgent = new http.Agent({ keepAlive: false, timeout: 60_000 });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const signal =
      init?.signal ??
      AbortSignal.timeout(Number(process.env.STUDIO_FETCH_TIMEOUT_MS || 12_000));
    return originalFetch(input, { ...init, signal });
  };
}

async function sdk() {
  prepareNodeTransport();
  return import("genlayer-js");
}

async function encodedArgs(args: CalldataValue[]) {
  const { CalldataAddress } = await import("genlayer-js/types");
  const encode = (value: CalldataValue): unknown => {
    if (typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) {
      return new CalldataAddress(
        Uint8Array.from(Buffer.from(value.slice(2), "hex"))
      );
    }
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === "object" && !(value instanceof Uint8Array)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, encode(item)])
      );
    }
    return value;
  };
  return args.map(encode);
}

async function createPublicClient() {
  const { createClient, chains } = await sdk();
  return createClient({ chain: chains.studionet, endpoint: env.studioRpc });
}

export async function publicClient() {
  if (!sharedPublicClient) {
    sharedPublicClient = await createPublicClient();
  }
  return sharedPublicClient;
}

export async function walletClient(privateKey: string) {
  const { createAccount, createClient, chains } = await sdk();
  const account = createAccount(privateKey as `0x${string}`);
  const client = createClient({
    chain: chains.studionet,
    account,
    endpoint: env.studioRpc,
  });
  return { client, account };
}

export async function readContract<T>(
  contract: Address,
  functionName: string,
  args: CalldataValue[] = []
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const client = await publicClient();
      return (await client.readContract({
        address: contract,
        functionName,
        args: (await encodedArgs(args)) as never,
        jsonSafeReturn: true,
      })) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function submitWrite({
  privateKey,
  contract,
  functionName,
  args = [],
  value = 0n,
}: {
  privateKey: string;
  contract: Address;
  functionName: string;
  args?: CalldataValue[];
  value?: bigint;
}) {
  const { client } = await walletClient(privateKey);
  return (await client.writeContract({
    address: contract,
    functionName,
    args: (await encodedArgs(args)) as never,
    value,
  })) as `0x${string}`;
}

function executionError(tx: Record<string, unknown>) {
  const consensus = tx.consensus_data as
    | { leader_receipt?: Array<Record<string, unknown>> }
    | undefined;
  const leader = consensus?.leader_receipt?.[0];
  const execution =
    tx.txExecutionResultName ??
    tx.tx_execution_result_name ??
    leader?.execution_result;
  if (
    execution === "ERROR" ||
    execution === "FINISHED_WITH_ERROR" ||
    execution === 2
  ) {
    return JSON.stringify(leader?.genvm_result ?? leader ?? tx).slice(0, 1000);
  }
  return null;
}

export async function waitForFinality(
  hash: `0x${string}`,
  retries = 240
): Promise<Record<string, unknown>> {
  const client = await publicClient();
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const tx = (await client.getTransaction({ hash: hash as never })) as unknown as Record<
        string,
        unknown
      >;
      const status = String(tx.statusName ?? tx.status ?? "");
      if (status === "FINALIZED" || Number(tx.status) === 7) {
        const problem = executionError(tx);
        if (problem) throw new Error(`Contract execution failed: ${problem}`);
        return tx;
      }
      if (status === "CANCELED" || Number(tx.status) === 8) {
        throw new Error("Transaction was canceled before finality");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith("Contract execution failed") ||
          error.message.startsWith("Transaction was canceled"))
      ) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error("StudioNet did not finalize the transaction in time");
}

export async function walletBalance(address: Address) {
  const client = await publicClient();
  return client.getBalance({ address });
}

export async function ensureWalletFunding(address: Address) {
  const minimum = 50_000_000_000_000_000n;
  const current = await walletBalance(address);
  if (current >= minimum) return null;
  if (!env.deployerKey) {
    throw new Error("The player wallet needs GEN and DEPLOYER_KEY is not configured");
  }
  const { client: operator, account } = await walletClient(env.deployerKey);
  const nonce = await operator.getCurrentNonce({ address: account.address });
  const gasPrice = await operator.request({ method: "eth_gasPrice" });
  const serializedTransaction = await account.signTransaction({
    account,
    to: address,
    type: "legacy",
    nonce: Number(nonce),
    value: 500_000_000_000_000_000n,
    gas: 21_000n,
    gasPrice: BigInt(gasPrice),
    chainId: env.chainId,
  });
  const hash = await operator.sendRawTransaction({ serializedTransaction });
  await waitForFinality(hash as `0x${string}`, 120);
  return hash;
}
