import { NextResponse } from "next/server";
import { worldSnapshot } from "@/lib/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await worldSnapshot());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read StudioNet";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
