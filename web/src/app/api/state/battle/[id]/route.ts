import { NextResponse } from "next/server";
import { contracts } from "@/lib/addresses";
import { readContract } from "@/lib/genlayer";
import type { Battle, Biome, Creature } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^bt_[0-9]{6}$/.test(id)) {
    return NextResponse.json({ error: "Invalid battle ID" }, { status: 400 });
  }
  const battle = await readContract<Battle>(contracts.arena, "get_battle", [id]);
  if (!battle.exists) {
    return NextResponse.json({ error: "Battle not found" }, { status: 404 });
  }
  const [attacker, defender, biome] = await Promise.all([
    readContract<Creature>(contracts.bestiary, "get_creature", [
      battle.attacker_id,
    ]),
    readContract<Creature>(contracts.bestiary, "get_creature", [
      battle.defender_id,
    ]),
    readContract<Biome>(contracts.arena, "get_biome", [battle.biome_key]),
  ]);
  return NextResponse.json({ battle, attacker, defender, biome });
}
