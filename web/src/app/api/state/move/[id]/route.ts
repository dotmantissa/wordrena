import { NextResponse } from "next/server";
import { contracts } from "@/lib/addresses";
import { readContract } from "@/lib/genlayer";
import type { Dispute, Move } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^mv_[0-9]{6}$/.test(id)) {
    return NextResponse.json({ error: "Invalid move ID" }, { status: 400 });
  }
  const [move, disputes] = await Promise.all([
    readContract<Move>(contracts.bestiary, "get_move", [id]),
    readContract<Dispute[]>(contracts.tribunal, "disputes_for_move", [id]),
  ]);
  if (!move.exists) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }
  return NextResponse.json({ move, disputes });
}
