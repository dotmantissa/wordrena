import { NextResponse } from "next/server";
import { recentTransactions } from "@/lib/db";
import { rosterSnapshot } from "@/lib/indexer";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const [creatures, transactions] = await Promise.all([
      rosterSnapshot(user.wallet),
      recentTransactions(user.userId),
    ]);
    return NextResponse.json({ user, creatures, transactions });
  } catch (error) {
    const auth = error instanceof Error && error.message === "AUTH_REQUIRED";
    return NextResponse.json(
      { error: auth ? "Sign in to see your roster" : "Could not load your roster" },
      { status: auth ? 401 : 502 }
    );
  }
}
