import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { getAccountSummary } from "$lib/server/eatright-data";
import { DEV_MODE } from "$lib/server/dev";

export async function GET(event) {
  if (DEV_MODE) {
    return json({
      username: "devuser",
      name: "Dev User",
      walletBalance: "250.00",
    });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  try {
    const account = await getAccountSummary(session.accessToken);
    return json({
      username: session.username,
      name: account.user,
      walletBalance: account.walletBalance,
    });
  } catch (error) {
    console.error(error);
    return json({ username: session.username });
  }
}
