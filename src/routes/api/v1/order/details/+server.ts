import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { DEV_MODE } from "$lib/server/dev";

const BASE_URL = "https://eatright.loyolacollege.edu";
const REFERER = `${BASE_URL}/pagecontroller.jsp`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

export async function GET(event) {
  const { url } = event;
  const orderNo = url.searchParams.get("order_no");
  const outletId = url.searchParams.get("outletid");

  if (!orderNo || !outletId) {
    return json(
      {
        error: "Order number and outlet id are required",
        errorCode: "missing_parameters",
      },
      { status: 400 },
    );
  }

  if (DEV_MODE) {
    return json({
      order_no: orderNo,
      outletid: outletId,
      order_status: "Delivered",
      grand_total: 240,
      items: [
        { id: 101, itemname: "Chicken Momo - Steamed", amount: 120, qty: 2 },
      ],
    });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader } = session;

  const response = await fetch(
    `${BASE_URL}/ajax/getOrderDetails.jsp?order_no=${encodeURIComponent(orderNo)}&outletid=${encodeURIComponent(outletId)}`,
    {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Referer: REFERER,
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader,
      },
    },
  );

  const text = await response.text();

  if (!response.ok) {
    return json(
      {
        error: "Failed to load EatRight order details",
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
        error: "EatRight returned an invalid order details response",
        response: text,
      },
      { status: 502 },
    );
  }
}
