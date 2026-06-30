import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
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

  return json({
    username: session.username,
  });
}
