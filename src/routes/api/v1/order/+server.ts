import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { clearEatRightDataCache } from "$lib/server/eatright-data";
import { DEV_MODE } from "$lib/server/dev";

const BASE_URL = "https://eatright.loyolacollege.edu";
const REFERER = `${BASE_URL}/pagecontroller.jsp`;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

type OrderItem = {
  id: number;
  itemname: string;
  amount: number;
  qty: number;
  shopno: number;
  outletid: number;
  outletname: string;
};

type PlacedOrder = {
  order_no: string;
  outletid: number;
};

function eatRightHeaders(cookieHeader: string) {
  return {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: BASE_URL,
    Referer: REFERER,
    "User-Agent": USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookieHeader,
  };
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

function toEatRightCartPayload(cart: OrderItem[]) {
  return cart.map((item) => ({
    id: Number(item.id),
    name: item.itemname,
    qty: Number(item.qty),
    price: Number(item.amount),
    total: Number(item.amount) * Number(item.qty),
    shopno: Number(item.shopno),
    outletid: Number(item.outletid),
  }));
}

function normalizePlacedOrders(placeOrderPayload: unknown, cart: ReturnType<typeof toEatRightCartPayload>): PlacedOrder[] {
  const payload = placeOrderPayload as Record<string, unknown> | null;
  const orders = payload?.orders;

  if (Array.isArray(orders)) {
    return orders
      .map((order) => {
        const value = order as Record<string, unknown>;
        const orderNo = String(value.order_no ?? value.orderNo ?? "");
        const outletId = Number(value.outletid ?? value.outletId ?? cart[0]?.outletid);
        return { order_no: orderNo, outletid: outletId };
      })
      .filter((order) => order.order_no && Number.isFinite(order.outletid));
  }

  const orderNos = payload?.order_nos ?? payload?.orderNos ?? payload?.order_no ?? payload?.orderNo;
  const normalizedOrderNos = Array.isArray(orderNos) ? orderNos : orderNos ? [orderNos] : [];
  const outletIds = [...new Set(cart.map((item) => item.outletid))];

  return normalizedOrderNos
    .map((orderNo, index) => ({
      order_no: String(orderNo),
      outletid: Number(outletIds[index] ?? outletIds[0]),
    }))
    .filter((order) => order.order_no && Number.isFinite(order.outletid));
}

export async function POST(event) {
  const { request } = event;
  const {
    cart,
  }: {
    cart: OrderItem[];
  } = await request.json();

  if (DEV_MODE) {
    return json({
      success: true,
      orders: (cart ?? []).length > 0
        ? [{ order_no: "DEV-" + Date.now(), outletid: cart[0]?.outletid ?? 1 }]
        : [],
      grandTotal: (cart ?? []).reduce((sum, item) => sum + item.amount * item.qty, 0),
      payment: { status: "success" },
      redirectUrl: "/view/home",
    });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader, username } = session;

  if (!Array.isArray(cart) || cart.length === 0) {
    return json(
      {
        error: "Cart is empty",
        errorCode: "cart_empty",
      },
      { status: 400 },
    );
  }

  const orderCart = toEatRightCartPayload(cart);
  const grandTotal = orderCart.reduce((sum, item) => sum + item.total, 0);

  if (
    orderCart.some(
      (item) =>
        !Number.isFinite(item.id) ||
        !Number.isFinite(item.qty) ||
        !Number.isFinite(item.price) ||
        !Number.isFinite(item.total) ||
        !Number.isFinite(item.shopno) ||
        !Number.isFinite(item.outletid) ||
        item.qty <= 0,
    )
  ) {
    return json(
      {
        error: "Cart contains invalid items",
        errorCode: "cart_invalid",
      },
      { status: 400 },
    );
  }

  const form = new URLSearchParams();

  form.set("cart", JSON.stringify(orderCart));
  form.set("grandTotal", String(grandTotal));
  form.set("paymentStatus", "Payment Not Made");
  form.set("userid", username);

  const response = await fetch(
    `${BASE_URL}/ajax/placeOrder.jsp`,
    {
      method: "POST",
      headers: eatRightHeaders(cookieHeader),
      body: form.toString(),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    return json(
      {
        error: "Failed to place EatRight order",
        response: text,
      },
      { status: response.status },
    );
  }

  const placeOrderPayload = parseJsonText(text);
  if (!placeOrderPayload) {
    return json(
      {
        error: "EatRight returned an invalid place order response",
        response: text,
      },
      { status: 502 },
    );
  }

  const placedOrders = normalizePlacedOrders(placeOrderPayload, orderCart);
  if (placedOrders.length === 0) {
    return json(
      {
        error: "EatRight did not return an order number",
        response: placeOrderPayload,
      },
      { status: 502 },
    );
  }

  const paymentForm = new URLSearchParams();
  paymentForm.set("order_nos", JSON.stringify(placedOrders.map((order) => order.order_no)));
  paymentForm.set("grand_total", String(grandTotal));

  const paymentResponse = await fetch(`${BASE_URL}/ajax/makePayment.jsp`, {
    method: "POST",
    headers: eatRightHeaders(cookieHeader),
    body: paymentForm.toString(),
  });
  const paymentText = await paymentResponse.text();

  if (!paymentResponse.ok) {
    return json(
      {
        error: "Failed to make EatRight wallet payment",
        response: paymentText,
      },
      { status: paymentResponse.status },
    );
  }

  const payment = parseJsonText(paymentText);
  if (
    !payment ||
    typeof payment !== "object" ||
    (payment as Record<string, unknown>).status !== "success"
  ) {
    return json(
      {
        error: "EatRight payment was not completed",
        response: payment ?? paymentText,
      },
      { status: 502 },
    );
  }

  clearEatRightDataCache(cookieHeader);

  return json({
    success: true,
    orders: placedOrders,
    grandTotal,
    payment,
    redirectUrl: `/view/confirmation?${placedOrders
      .map((order) => `order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`)
      .join("&")}`,
  });
}
