import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { DEV_MODE } from "$lib/server/dev";
import * as cheerio from "cheerio";

const PAGE_CONTROLLER_URL = "https://eatright.loyolacollege.edu/pagecontroller.jsp";
const USER_AGENT = "Mozilla/5.0";

export async function GET(event) {
  if (DEV_MODE) {
    return json([
      { id: 1, name: "Momo's Kitchen", shopNo: 1, isClosed: false },
      { id: 2, name: "Fish Fry Center", shopNo: 2, isClosed: false },
    ]);
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  const { cookieHeader } = session;

  try {
    const response = await fetch(PAGE_CONTROLLER_URL, {
      headers: { "User-Agent": USER_AGENT, Cookie: cookieHeader },
    });

    if (!response.ok) {
      return json({ error: "Failed to load outlets" }, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const outlets = $(".outlet-card")
      .map((_, el) => ({
        id: Number($(el).attr("data-id") ?? 0),
        name: $(el).attr("data-name") ?? "",
        shopNo: Number($(el).attr("data-outletno") ?? 0),
        isClosed: $(el).hasClass("disabled-outlet"),
      }))
      .get();

    return json(outlets);
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to scrape page" }, { status: 500 });
  }
}
