import "server-only";

export type RelayAction =
  | "craftCreature"
  | "forgeMove"
  | "levelUp"
  | "retireMove"
  | "duel"
  | "refreshBiome"
  | "fileDispute"
  | "resolveDispute";

type ActionSpec = {
  contractName: "bestiary" | "arena" | "tribunal";
  methodName: string;
  args: Array<string | number | bigint | boolean>;
  value?: bigint;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The action payload is not valid");
  }
  return value as Record<string, unknown>;
}

function text(
  payload: Record<string, unknown>,
  key: string,
  min: number,
  max: number
) {
  const value = String(payload[key] ?? "").trim();
  if (value.length < min || value.length > max) {
    throw new Error(`${key} needs ${min} to ${max} characters`);
  }
  return value;
}

function id(payload: Record<string, unknown>, key: string, prefix: string) {
  const value = String(payload[key] ?? "").trim();
  if (!new RegExp(`^${prefix}_[0-9]{6}$`).test(value)) {
    throw new Error(`${key} is not valid`);
  }
  return value;
}

function oneOf(
  payload: Record<string, unknown>,
  key: string,
  allowed: readonly string[]
) {
  const value = String(payload[key] ?? "").trim().toLowerCase();
  if (!allowed.includes(value)) {
    throw new Error(`${key} must be ${allowed.join(" or ")}`);
  }
  return value;
}

function genAmount(value: unknown) {
  const raw = String(value ?? "0").trim();
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) {
    throw new Error("The appeal bond must be a plain GEN amount");
  }
  const [whole, fraction = ""] = raw.split(".");
  const amount =
    BigInt(whole) * 10n ** 18n +
    BigInt(fraction.padEnd(18, "0"));
  if (amount > 1n * 10n ** 18n) {
    throw new Error("The appeal bond cannot exceed 1 GEN");
  }
  return amount;
}

export function actionSpec(action: unknown, input: unknown): ActionSpec {
  const payload = object(input);
  switch (action as RelayAction) {
    case "craftCreature":
      return {
        contractName: "bestiary",
        methodName: "craft_creature",
        args: [
          text(payload, "name", 2, 28),
          oneOf(payload, "element", [
            "ember",
            "tide",
            "gale",
            "terra",
            "umbra",
            "lumen",
          ]),
        ],
      };
    case "forgeMove":
      return {
        contractName: "bestiary",
        methodName: "forge_move",
        args: [
          id(payload, "creatureId", "cr"),
          text(payload, "name", 2, 36),
          text(payload, "prompt", 12, 600),
        ],
      };
    case "levelUp":
      return {
        contractName: "bestiary",
        methodName: "level_up",
        args: [id(payload, "creatureId", "cr")],
      };
    case "retireMove":
      return {
        contractName: "bestiary",
        methodName: "retire_move",
        args: [id(payload, "moveId", "mv")],
      };
    case "duel":
      return {
        contractName: "arena",
        methodName: "duel",
        args: [
          id(payload, "attackerId", "cr"),
          id(payload, "defenderId", "cr"),
          text(payload, "biomeKey", 3, 30).toLowerCase(),
        ],
      };
    case "refreshBiome":
      return {
        contractName: "arena",
        methodName: "refresh_biome",
        args: [text(payload, "biomeKey", 3, 30).toLowerCase()],
      };
    case "fileDispute":
      return {
        contractName: "tribunal",
        methodName: "file_dispute",
        args: [
          id(payload, "moveId", "mv"),
          text(payload, "claim", 8, 400),
          oneOf(payload, "direction", ["buff", "nerf"]),
        ],
        value: genAmount(payload.bond),
      };
    case "resolveDispute":
      return {
        contractName: "tribunal",
        methodName: "resolve_dispute",
        args: [id(payload, "disputeId", "dp")],
      };
    default:
      throw new Error("That action is not available");
  }
}

export function friendlyContractError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const expected = raw.match(/\[EXPECTED\]\s*([^"\\}\]]+)/);
  if (expected?.[1]) {
    const message = expected[1].trim();
    return message.charAt(0).toUpperCase() + message.slice(1);
  }
  if (raw.includes("AUTH_REQUIRED")) return "Sign in before entering the arena";
  if (raw.includes("insufficient funds")) {
    return "The player wallet could not be funded for this move";
  }
  if (raw.includes("did not finalize")) {
    return "StudioNet is taking longer than usual. Check your roster in a moment";
  }
  return raw.length <= 240 ? raw : "The chain rejected that action";
}
