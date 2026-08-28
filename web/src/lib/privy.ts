import "server-only";
import { PrivyClient } from "@privy-io/node";
import { env, requireServerEnv } from "./env";

let client: PrivyClient | null = null;

function privy() {
  requireServerEnv("privyAppId", "privyAppSecret");
  if (!client) {
    client = new PrivyClient({
      appId: env.privyAppId,
      appSecret: env.privyAppSecret,
    });
  }
  return client;
}

export async function verifiedPrivyUser(accessToken: string) {
  const verified = await privy().utils().auth().verifyAccessToken(accessToken);
  const user = await privy().users()._get(verified.user_id);
  const emailAccount = user.linked_accounts.find(
    (account) => account.type === "email"
  );
  if (!emailAccount || !("address" in emailAccount)) {
    throw new Error("Wordrena requires a verified email account");
  }
  return {
    privyId: user.id,
    email: String(emailAccount.address).toLowerCase(),
  };
}
