import { json } from "@sveltejs/kit";
import { resolveEatRightSession } from "$lib/server/eatright";

export async function GET({cookies}) {
  const session = await resolveEatRightSession({
    cookies,
  });
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader } = session;

  const response = await fetch(
    "https://eatright.loyolacollege.edu/ajax/getUserOrders.jsp",
    {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: "https://eatright.loyolacollege.edu/pagecontroller.jsp",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader,
      },
    },
  );

  const text = await response.text();

  if (!response.ok) {
    return json(
      {
        error: "Failed to load EatRight order history",
        response: text,
      },
      { status: response.status },
    );
  }

  try {
    return json(JSON.parse(text.trim()));
  } catch {
    return json(
      {
        error: "EatRight returned an invalid order history response",
        response: text,
      },
      { status: 502 },
    );
  }
}
