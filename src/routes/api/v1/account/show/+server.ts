import { json } from "@sveltejs/kit";
import { resolveEatRightSession } from "$lib/server/eatright";
import * as cheerio from "cheerio";

const PAGE_CONTROLLER_URL = "https://eatright.loyolacollege.edu/pagecontroller.jsp";
const USER_AGENT = "Mozilla/5.0";

export async function GET({cookies}) {
  const session = await resolveEatRightSession({
    cookies,
  });
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader, reauthenticated } = session;

  try {
    const response = await fetch(PAGE_CONTROLLER_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      return json(
        {
          error: "Failed to load EatRight account",
        },
        { status: response.status },
      );
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

    const walletBalance = parseFloat(
      $("h5.text-success")
        .text()
        .match(/₹\s*([\d]+(?:\.\d+)?)/)?.[1] ?? "0",
    ).toFixed(2);

    const user = $("#navmenu li:first-child a").text().trim();

    return json({
      user,
      walletBalance,
      outlets,
      reauthenticated,
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        error: "Failed to scrape page",
      },
      {
        status: 500,
      },
    );
  }
}
