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
  if (!/^dp_[0-9]{6}$/.test(id)) {
    return NextResponse.json({ error: "Invalid dispute ID" }, { status: 400 });
  }
  const dispute = await readContract<Dispute>(
    contracts.tribunal,
    "get_dispute",
    [id]
  );
  if (!dispute.exists) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }
  const move = await readContract<Move>(contracts.bestiary, "get_move", [
    dispute.move_id,
  ]);
  return NextResponse.json({ dispute, move });
}
