import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "wordrena_session";
const MAX_AGE = 60 * 60 * 24 * 7; // a week in the arena before you sign in again

export type SessionUser = {
  userId: string;
  privyId: string;
  email: string;
  wallet: string;
};

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(secret.padEnd(32, "0"));
}

export async function startSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: user.privyId,
    uid: user.userId,
    email: user.email,
    wallet: user.wallet,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(sessionKey());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.uid !== "string" ||
      typeof payload.wallet !== "string"
    )
      return null;
    return {
      userId: payload.uid,
      privyId: payload.sub,
      email: payload.email,
      wallet: payload.wallet,
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}
