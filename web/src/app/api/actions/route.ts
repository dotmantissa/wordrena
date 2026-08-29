import { NextResponse } from "next/server";
import { actionSpec, friendlyContractError } from "@/lib/actions";
import { assertWriteRateLimit, getPlayerById } from "@/lib/db";
import { relayWrite } from "@/lib/indexer";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const player = await getPlayerById(session.userId);
    if (!player) {
      return NextResponse.json(
        { error: "Your player record could not be found" },
        { status: 401 }
      );
    }
    await assertWriteRateLimit(player.id);

    const body = (await request.json()) as {
      action?: unknown;
      input?: unknown;
    };
    const spec = actionSpec(body.action, body.input);
    const result = await relayWrite({
      player,
      action: String(body.action),
      ...spec,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = friendlyContractError(error);
    const status =
      error instanceof Error && error.message.includes("AUTH_REQUIRED")
        ? 401
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
