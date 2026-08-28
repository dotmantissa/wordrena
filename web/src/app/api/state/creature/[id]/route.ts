import { NextResponse } from "next/server";
import { contracts } from "@/lib/addresses";
import { readContract } from "@/lib/genlayer";
import type { Battle, Creature, Move } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^cr_[0-9]{6}$/.test(id)) {
    return NextResponse.json({ error: "Invalid creature ID" }, { status: 400 });
  }
  const [creature, moves, battles] = await Promise.all([
    readContract<Creature>(contracts.bestiary, "get_creature", [id]),
    readContract<Move[]>(contracts.bestiary, "get_creature_moves", [id]),
    readContract<Battle[]>(contracts.arena, "battles_for_creature", [id, 12]),
  ]);
  if (!creature.exists) {
    return NextResponse.json({ error: "Creature not found" }, { status: 404 });
  }
  return NextResponse.json({ creature, moves, battles });
}
