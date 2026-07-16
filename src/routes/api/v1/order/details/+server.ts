import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { DEV_MODE } from "$lib/server/dev";
import { foodcourtApiRequest, FoodcourtApiError } from "$lib/server/foodcourt-api";

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
      orders: [
        {
          order_no: orderNo,
          orderid: 1,
          outletid: Number(outletId),
          outlet_name: "Momo's Kitchen",
          payment_status: "PAID",
          delivered: "N",
          delivereddate: null,
          grand_total: 240,
          items: [
            { order_item_id: 1, item_id: 101, item_name: "Chicken Momo - Steamed", price: 120, qty: 2, total: 240, status: "PLACED" },
          ],
        },
      ],
    });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) {
    return session.response;
  }

  try {
    return json(await foodcourtApiRequest(
      `/ajax/getOrderDetails.jsp?order_no=${encodeURIComponent(orderNo)}&outletid=${encodeURIComponent(outletId)}`,
      { accessToken: session.accessToken },
    ));
  } catch (error) {
    const status = error instanceof FoodcourtApiError ? error.status : 502;
    return json(
      { error: "Failed to load Foodcourt order details" },
      { status },
    );
  }
}
