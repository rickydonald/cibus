import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { clearEatRightDataCache } from "$lib/server/eatright-data";
import { DEV_MODE } from "$lib/server/dev";
import { officialApiUrl } from "$lib/server/foodcourt-api";
import { hasDuplicateItemIds } from "$lib/order-validation";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_CART_ITEMS = 50;
const MAX_ITEM_QTY = 10;
const MAX_TOTAL_QTY = 100;
const MAX_ORDER_TOTAL = 1000;
const CHECKOUT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrderItem = {
  id: number;
  itemname: string;
  amount: number;
  qty: number;
  shopno: number;
  outletid: number;
  outletname: string;
};

type CheckoutBody = {
  checkoutId?: unknown;
  cart?: unknown;
};

type BackendOrder = {
  order_no: string;
  outletid: number;
};

function foodcourtHeaders(accessToken: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Authorization: `Bearer ${accessToken}`,
  };
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text.trim());
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function validateCart(value: unknown): { cart: OrderItem[]; error?: never }
  | { cart?: never; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Cart is empty" };
  }
  if (value.length > MAX_CART_ITEMS) {
    return { error: `Cart cannot contain more than ${MAX_CART_ITEMS} items` };
  }

  const cart = value as OrderItem[];
  if (hasDuplicateItemIds(cart)) {
    return { error: "Cart contains duplicate items" };
  }

  let totalQty = 0;
  let total = 0;
  for (const item of cart) {
    if (!item || typeof item !== "object") return { error: "Cart contains invalid items" };
    if (
      !Number.isSafeInteger(item.id) || item.id <= 0 ||
      !Number.isSafeInteger(item.outletid) || item.outletid <= 0 ||
      !Number.isSafeInteger(item.shopno) || item.shopno <= 0 ||
      !Number.isInteger(item.qty) || item.qty < 1 || item.qty > MAX_ITEM_QTY ||
      !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > MAX_ORDER_TOTAL ||
      Math.abs(item.amount * 100 - Math.round(item.amount * 100)) > 1e-7 ||
      typeof item.itemname !== "string" || item.itemname.length < 1 || item.itemname.length > 200 ||
      typeof item.outletname !== "string" || item.outletname.length > 200
    ) {
      return { error: "Cart contains invalid items" };
    }
    totalQty += item.qty;
    total += item.amount * item.qty;
  }

  if (totalQty > MAX_TOTAL_QTY) return { error: "Cart quantity is too large" };
  if (!Number.isFinite(total) || total <= 0 || total > MAX_ORDER_TOTAL) {
    return { error: `Order total must be between ₹1 and ₹${MAX_ORDER_TOTAL}` };
  }
  return { cart };
}

function backendCart(cart: OrderItem[]) {
  return cart.map((item) => ({
    id: item.id,
    qty: item.qty,
    outletid: item.outletid,
    shopno: item.shopno,
  }));
}

function normalizeOrders(value: unknown): BackendOrder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const order = entry as Record<string, unknown>;
    const orderNo = String(order.order_no ?? "").trim();
    const outletId = Number(order.outletid);
    return orderNo && Number.isSafeInteger(outletId) && outletId > 0
      ? [{ order_no: orderNo, outletid: outletId }]
      : [];
  });
}

export async function POST(event) {
  const contentLength = Number(event.request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "Checkout request is too large", errorCode: "request_too_large" }, { status: 413 });
  }

  let body: CheckoutBody;
  try {
    body = await event.request.json();
  } catch {
    return json({ error: "Invalid JSON body", errorCode: "invalid_json" }, { status: 400 });
  }

  const checkoutId = typeof body.checkoutId === "string" ? body.checkoutId.trim() : "";
  if (!CHECKOUT_ID.test(checkoutId)) {
    return json({ error: "A valid checkout ID is required", errorCode: "checkout_id_invalid" }, { status: 400 });
  }

  const validated = validateCart(body.cart);
  if ("error" in validated) {
    return json({ error: validated.error, errorCode: "cart_invalid" }, { status: 400 });
  }

  if (DEV_MODE) {
    return json({
      success: true,
      orders: [{ order_no: `DEV-${checkoutId.slice(0, 8)}`, outletid: validated.cart[0].outletid }],
      grandTotal: validated.cart.reduce((sum, item) => sum + item.amount * item.qty, 0),
      payment: { status: "success" },
      redirectUrl: "/view/home",
    });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  const form = new URLSearchParams({
    checkout_id: checkoutId,
    cart: JSON.stringify(backendCart(validated.cart)),
  });

  let response: Response;
  try {
    response = await fetch(officialApiUrl("/ajax/api/checkoutOrder.jsp"), {
      method: "POST",
      headers: foodcourtHeaders(session.accessToken),
      body: form.toString(),
    });
  } catch {
    return json({ error: "Unable to reach the Foodcourt checkout service" }, { status: 502 });
  }

  const responseText = await response.text();
  const payload = parseJson(responseText);
  if (!response.ok || payload?.status !== "success") {
    const message = typeof payload?.message === "string"
      ? payload.message
      : "Foodcourt checkout could not be completed";
    return json(
      { error: message, errorCode: String(payload?.errorCode ?? "checkout_failed") },
      { status: response.status >= 400 && response.status < 500 ? response.status : 502 },
    );
  }

  const orders = normalizeOrders(payload.orders);
  if (orders.length === 0) {
    return json({ error: "Foodcourt did not return an order number" }, { status: 502 });
  }

  clearEatRightDataCache(session.accessToken);
  const grandTotal = Number(payload.grandTotal);
  return json({
    success: true,
    idempotent: payload.idempotent === true,
    orders,
    grandTotal: Number.isFinite(grandTotal) ? grandTotal : 0,
    payment: { status: "success", idempotent: payload.idempotent === true },
    redirectUrl: `/view/confirmation?${orders
      .map((order) => `order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`)
      .join("&")}`,
  });
}
