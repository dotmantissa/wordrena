import "server-only";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import type { Address } from "./types";

type AddressBook = {
  bestiary: Address;
  arena: Address;
  tribunal: Address;
  network: string;
  chainId: number;
};

function address(value: string, name: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} is not a valid contract address`);
  }
  return value as Address;
}

function deployedAddresses(): Partial<AddressBook> {
  try {
    const file = path.resolve(process.cwd(), "..", "deploy", "addresses.json");
    return JSON.parse(fs.readFileSync(file, "utf8")) as Partial<AddressBook>;
  } catch {
    return {};
  }
}

const deployed = deployedAddresses();

export const contracts: AddressBook = {
  bestiary: address(
    env.bestiaryAddress || deployed.bestiary || "",
    "BESTIARY_ADDRESS"
  ),
  arena: address(env.arenaAddress || deployed.arena || "", "ARENA_ADDRESS"),
  tribunal: address(
    env.tribunalAddress || deployed.tribunal || "",
    "TRIBUNAL_ADDRESS"
  ),
  network: deployed.network || "studionet",
  chainId: env.chainId,
};
