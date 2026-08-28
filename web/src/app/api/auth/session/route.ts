import { NextResponse } from "next/server";
import { getOrCreatePlayer } from "@/lib/db";
import { verifiedPrivyUser } from "@/lib/privy";
import {
  currentUser,
  endSession,
  startSession,
  type SessionUser,
} from "@/lib/session";
import {
  encryptSecret,
  newWalletKey,
  walletFromKey,
} from "@/lib/walletCrypto";

export const runtime = "nodejs";

function bearer(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim();
}

export async function GET() {
  return NextResponse.json({ user: await currentUser() });
}

export async function POST(request: Request) {
  const token = bearer(request);
  if (!token) {
    return NextResponse.json(
      { error: "A Privy access token is required" },
      { status: 401 }
    );
  }

  try {
    const identity = await verifiedPrivyUser(token);
    const key = newWalletKey();
    const wallet = walletFromKey(key);
    const player = await getOrCreatePlayer({
      privyId: identity.privyId,
      email: identity.email,
      walletAddress: wallet.address as `0x${string}`,
      encryptedPrivateKey: encryptSecret(key),
    });
    const sessionUser: SessionUser = {
      userId: player.id,
      privyId: player.privyId,
      email: player.email,
      wallet: player.walletAddress,
    };
    await startSession(sessionUser);
    return NextResponse.json({ user: sessionUser });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not verify this login";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
