import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { getAccountSummary } from "$lib/server/eatright-data";
import { DEV_MODE } from "$lib/server/dev";

export async function GET(event) {
  if (DEV_MODE) {
    return json([
      { id: 1, name: "Momo's Kitchen", shopNo: 1, isClosed: false },
      { id: 2, name: "Fish Fry Center", shopNo: 2, isClosed: false },
    ]);
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  try {
    const { outlets } = await getAccountSummary(session);
    return json(outlets);
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to load outlets from the Foodcourt API" }, { status: 502 });
  }
}
