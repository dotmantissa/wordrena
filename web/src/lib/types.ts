export type Address = `0x${string}`;

export type Creature = {
  exists: boolean;
  creature_id: string;
  owner: Address;
  name: string;
  element: string;
  archetype: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  xp: number;
  xp_to_next: number;
  move_ids: string[];
  wins: number;
  losses: number;
  battles: number;
  created_at: number;
  updated_at: number;
};

export type Move = {
  exists: boolean;
  move_id: string;
  creature_id: string;
  owner: Address;
  name: string;
  prompt: string;
  element: string;
  power: number;
  mana_cost: number;
  cooldown: number;
  accuracy: number;
  effect_kind: string;
  effect_magnitude: number;
  effect_duration: number;
  scaling: string;
  power_budget: number;
  verdict: string;
  status: string;
  disputes: number;
  forged_at: number;
  updated_at: number;
};

export type Biome = {
  exists: boolean;
  key: string;
  name: string;
  home_element: string;
  theme: string;
  buff_pct: number;
  hazard: number;
  conditions: string;
  source: string;
  refreshed_at: number;
};

export type Battle = {
  exists: boolean;
  battle_id: string;
  attacker_id: string;
  defender_id: string;
  attacker_name: string;
  defender_name: string;
  attacker_owner: Address;
  defender_owner: Address;
  biome_key: string;
  biome_conditions: string;
  winner_id: string;
  winner_owner: Address | "";
  turns: number;
  attacker_hp_left: number;
  defender_hp_left: number;
  xp_attacker: number;
  xp_defender: number;
  summary: string;
  created_at: number;
  log?: Array<Record<string, unknown>>;
};

export type Dispute = {
  exists: boolean;
  dispute_id: string;
  move_id: string;
  creature_id: string;
  move_name: string;
  move_prompt: string;
  element: string;
  challenger: Address;
  claim: string;
  direction: "buff" | "nerf";
  bond: number;
  old_power: number;
  old_mana: number;
  old_cooldown: number;
  old_budget: number;
  new_power: number;
  new_mana: number;
  new_cooldown: number;
  new_budget: number;
  status: "filed" | "upheld" | "rejected";
  reason_code: string;
  verdict_summary: string;
  filed_at: number;
  resolved_at: number;
};

export type PageResult<T> = {
  total: number;
  items: T[];
};

export type PlayerRecord = {
  id: string;
  privyId: string;
  email: string;
  walletAddress: Address;
  encryptedPrivateKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionRecord = {
  id: string;
  userId: string;
  action: string;
  contractName: string;
  methodName: string;
  txHash: string | null;
  status: "submitted" | "finalized" | "failed";
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};
