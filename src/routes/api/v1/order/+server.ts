import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { clearEatRightDataCache } from "$lib/server/eatright-data";
import { DEV_MODE } from "$lib/server/dev";
import { officialApiUrl } from "$lib/server/foodcourt-api";
import { hasDuplicateItemIds } from "$lib/order-validation";

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

type EatRightCartItem = ReturnType<typeof toEatRightCartPayload>[number];

function foodcourtHeaders(accessToken: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Authorization: `Bearer ${accessToken}`,
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

function getCartTotal(cart: EatRightCartItem[]) {
  return cart.reduce((sum, item) => sum + item.total, 0);
}

function getCartGroupKey(item: EatRightCartItem) {
  return `${item.outletid}:${item.shopno}`;
}

function groupCartByShop(cart: EatRightCartItem[]) {
  const groups = new Map<string, EatRightCartItem[]>();

  for (const item of cart) {
    const key = getCartGroupKey(item);
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return [...groups.values()];
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

function normalizeOrderList(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;

  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (Array.isArray(value.orders)) return value.orders as Array<Record<string, unknown>>;
    if (Array.isArray(value.data)) return value.data as Array<Record<string, unknown>>;
  }

  return [];
}

async function waitForOrdersToAppear(accessToken: string, placedOrders: PlacedOrder[]) {
  const expected = new Set(placedOrders.map((order) => order.order_no));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(officialApiUrl("/ajax/getUserOrders.jsp"), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const payload = parseJsonText(await response.text());
      const orders = normalizeOrderList(payload);
      const foundOrderNos = new Set(
        orders.map((order) => String(order.order_no ?? order.orderNo ?? "")),
      );
      const found = [...expected].every((orderNo) => foundOrderNos.has(orderNo));

      if (found) return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return false;
}

async function placeEatRightOrder(
  accessToken: string,
  userid: string,
  cart: EatRightCartItem[],
) {
  const form = new URLSearchParams();

  form.set("cart", JSON.stringify(cart));
  form.set("grandTotal", String(getCartTotal(cart)));
  form.set("paymentStatus", "Payment Not Made");
  form.set("userid", userid);

  const response = await fetch(officialApiUrl("/ajax/placeOrder.jsp"), {
    method: "POST",
    headers: foodcourtHeaders(accessToken),
    body: form.toString(),
  });
  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: "Failed to place EatRight order",
      response: text,
    };
  }

  const payload = parseJsonText(text);
  if (!payload) {
    return {
      ok: false as const,
      status: 502,
      error: "EatRight returned an invalid place order response",
      response: text,
    };
  }

  const orders = normalizePlacedOrders(payload, cart);
  if (orders.length === 0) {
    return {
      ok: false as const,
      status: 502,
      error: "EatRight did not return an order number",
      response: payload,
    };
  }

  return {
    ok: true as const,
    orders,
  };
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

  const { accessToken, userid } = session;

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
  const grandTotal = getCartTotal(orderCart);
  const hasDuplicateItems = hasDuplicateItemIds(orderCart);

  if (
    hasDuplicateItems ||
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
        error: hasDuplicateItems
          ? "Cart contains duplicate items"
          : "Cart contains invalid items",
        errorCode: hasDuplicateItems ? "cart_duplicate_item" : "cart_invalid",
      },
      { status: 400 },
    );
  }

  const orderGroups = groupCartByShop(orderCart);
  const placedOrders: PlacedOrder[] = [];

  for (const group of orderGroups) {
    const placedOrder = await placeEatRightOrder(accessToken, userid, group);

    if (!placedOrder.ok) {
      return json(
        {
          error: placedOrder.error,
          response: placedOrder.response,
        },
        { status: placedOrder.status },
      );
    }

    placedOrders.push(...placedOrder.orders);
  }

  const paymentForm = new URLSearchParams();
  paymentForm.set("order_nos", JSON.stringify(placedOrders.map((order) => order.order_no)));
  paymentForm.set("grand_total", String(grandTotal));

  const paymentResponse = await fetch(officialApiUrl("/ajax/makePayment.jsp"), {
    method: "POST",
    headers: foodcourtHeaders(accessToken),
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

  clearEatRightDataCache(accessToken);
  const isRecorded = await waitForOrdersToAppear(accessToken, placedOrders);

  if (!isRecorded) {
    return json(
      {
        error: "EatRight accepted payment but did not record the order in history.",
        errorCode: "order_not_recorded",
        orders: placedOrders,
        grandTotal,
        payment,
      },
      { status: 502 },
    );
  }

  return json({
    success: true,
    orders: placedOrders,
    grandTotal,
    payment,
    isRecorded,
    redirectUrl: `/view/confirmation?${placedOrders
      .map((order) => `order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`)
      .join("&")}`,
  });
}
