import { createHash } from "node:crypto";
import { json, type Cookies, type RequestEvent, type RequestHandler } from "@sveltejs/kit";
import {
  EatRightError,
  type AccountSummary,
  type CartItem,
  type EatRightRemote,
  type Endpoint,
  type MenuItem,
  type PlacedOrder,
  type RemoteCartItem,
  type RemoteSession,
} from "./contract";
import { createSessionCodec } from "./session";

type Dependencies = {
  remote: EatRightRemote;
  sessionSecret: string;
  secureCookies: boolean;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

class TimedCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > this.now()) return existing.value;

    const value = load().catch((error) => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { expiresAt: this.now() + this.ttlMs, value });
    return value;
  }

  deletePrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }
}

function sessionKey(session: RemoteSession): string {
  return createHash("sha256").update(session.cookies).digest("base64url");
}

function toRemoteCart(cart: CartItem[]): RemoteCartItem[] {
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

function validCart(cart: RemoteCartItem[]): boolean {
  return cart.every((item) =>
    [item.id, item.qty, item.price, item.total, item.shopno, item.outletid].every(Number.isFinite) &&
    item.qty > 0,
  );
}

function groupCart(cart: RemoteCartItem[]): RemoteCartItem[][] {
  const groups = new Map<string, RemoteCartItem[]>();
  for (const item of cart) {
    const key = `${item.outletid}:${item.shopno}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}

async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new EatRightError("invalid_json", 400, "Invalid JSON body");
  }
}

export function createEatRightModule({
  remote,
  sessionSecret,
  secureCookies,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: Dependencies) {
  const sessions = createSessionCodec(sessionSecret, secureCookies);
  const validationCache = new TimedCache<boolean>(60_000, now);
  const accountCache = new TimedCache<AccountSummary>(20_000, now);
  const menuCache = new TimedCache<MenuItem[]>(20_000, now);

  function invalidate(session: RemoteSession): void {
    const prefix = `${sessionKey(session)}:`;
    accountCache.deletePrefix(prefix);
    menuCache.deletePrefix(prefix);
  }

  async function resolveSession(event: RequestEvent): Promise<{
    session: RemoteSession;
    reauthenticated: boolean;
  }> {
    const current = sessions.read(event.cookies);
    if (!current) {
      throw new EatRightError(
        "eatright_session_missing",
        401,
        "Eat Right account is not connected",
      );
    }

    const key = sessionKey(current);
    const valid = await validationCache.get(`${key}:validation`, () => remote.validate(current));
    if (valid) return { session: current, reauthenticated: false };

    try {
      const renewed = await remote.login(current.credentials);
      sessions.write(event.cookies, renewed);
      invalidate(current);
      return { session: renewed, reauthenticated: true };
    } catch {
      sessions.clear(event.cookies);
      throw new EatRightError(
        "eatright_session_expired",
        401,
        "Eat Right session expired. Please reconnect your account.",
      );
    }
  }

  function account(session: RemoteSession): Promise<AccountSummary> {
    const key = sessionKey(session);
    return accountCache.get(`${key}:account`, () => remote.account(session));
  }

  function menu(
    session: RemoteSession,
    outletId: number,
    shopNo: number,
  ): Promise<MenuItem[]> {
    const key = sessionKey(session);
    return menuCache.get(
      `${key}:menu:${outletId}:${shopNo}`,
      () => remote.menu(session, outletId, shopNo),
    );
  }

  async function login(event: RequestEvent): Promise<Response> {
    const body = await readJsonBody<{ userId?: string; password?: string }>(event.request);
    const username = body.userId?.trim();
    if (!username || !body.password) {
      throw new EatRightError(
        "invalid_input",
        400,
        "userId and password are required",
      );
    }

    const session = await remote.login({ username, password: body.password });
    if (!(await remote.validate(session))) {
      throw new EatRightError(
        "eatright_login_failed",
        401,
        "Login failed – check your user ID and password",
      );
    }
    sessions.write(event.cookies, session);
    return json({ success: true, redirectUrl: "/view/home" });
  }

  async function accountResponse(event: RequestEvent): Promise<Response> {
    const resolved = await resolveSession(event);
    return json({
      ...(await account(resolved.session)),
      reauthenticated: resolved.reauthenticated,
    });
  }

  async function menuResponse(event: RequestEvent): Promise<Response> {
    const outletId = Number(event.params.outlet_id);
    const shopNo = Number(event.params.shop_no);
    if (!Number.isFinite(outletId) || !Number.isFinite(shopNo)) {
      throw new EatRightError("invalid_input", 400, "Invalid outlet or shop number");
    }
    const { session } = await resolveSession(event);
    return json(await menu(session, outletId, shopNo));
  }

  async function search(event: RequestEvent): Promise<Response> {
    const query = event.url.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return json({ results: [] });

    const { session } = await resolveSession(event);
    const openOutlets = (await account(session)).outlets.filter((outlet) => !outlet.isClosed);
    const menus = await Promise.all(
      openOutlets.map((outlet) =>
        menu(session, outlet.id, outlet.shopNo).catch(() => []),
      ),
    );
    const normalizedQuery = query.toLowerCase();
    const results = openOutlets.flatMap((outlet, index) =>
      menus[index]
        .filter((item) => item.itemname.toLowerCase().includes(normalizedQuery))
        .map((item) => ({ ...item, shopno: outlet.shopNo })),
    );
    return json({ results });
  }

  async function orders(event: RequestEvent): Promise<Response> {
    const { session } = await resolveSession(event);
    return json(
      { orders: await remote.orders(session) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  async function orderDetails(event: RequestEvent): Promise<Response> {
    const orderNo = event.url.searchParams.get("order_no");
    const outletId = event.url.searchParams.get("outletid");
    if (!orderNo || !outletId) {
      throw new EatRightError(
        "missing_parameters",
        400,
        "Order number and outlet id are required",
      );
    }
    const { session } = await resolveSession(event);
    return json(await remote.orderDetails(session, orderNo, outletId));
  }

  async function placeOrder(event: RequestEvent): Promise<Response> {
    const body = await readJsonBody<{ cart?: CartItem[] }>(event.request);
    if (!Array.isArray(body.cart) || !body.cart.length) {
      throw new EatRightError("cart_empty", 400, "Cart is empty");
    }

    const cart = toRemoteCart(body.cart);
    if (!validCart(cart)) {
      throw new EatRightError("cart_invalid", 400, "Cart contains invalid items");
    }

    const { session } = await resolveSession(event);
    const placedOrders: PlacedOrder[] = [];
    try {
      for (const group of groupCart(cart)) {
        placedOrders.push(
          ...await remote.placeOrder(session, session.credentials.username, group),
        );
      }
    } catch (error) {
      if (!placedOrders.length) throw error;
      throw new EatRightError(
        "order_partially_placed",
        502,
        "Some items were ordered before Eat Right stopped responding",
        { orders: placedOrders },
      );
    }

    const grandTotal = cart.reduce((total, item) => total + item.total, 0);
    const payment = await remote.pay(session, placedOrders, grandTotal);
    invalidate(session);

    const expected = new Set(placedOrders.map((order) => order.order_no));
    let isRecorded = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const history = await remote.orders(session).catch(() => []);
      const found = new Set(
        history.map((order) => String(order.order_no ?? order.orderNo ?? "")),
      );
      if ([...expected].every((orderNo) => found.has(orderNo))) {
        isRecorded = true;
        break;
      }
      if (attempt < 2) await sleep(700);
    }

    if (!isRecorded) {
      throw new EatRightError(
        "order_not_recorded",
        502,
        "Eat Right accepted payment but did not record the order in history.",
        { orders: placedOrders, grandTotal, payment },
      );
    }

    return json({
      success: true,
      orders: placedOrders,
      grandTotal,
      payment,
      isRecorded,
      redirectUrl: `/view/confirmation?${placedOrders
        .map((order) =>
          `order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`,
        )
        .join("&")}`,
    });
  }

  async function wallet(event: RequestEvent): Promise<Response> {
    const { session } = await resolveSession(event);
    return json({ transactions: await remote.wallet(session) });
  }

  async function recharge(event: RequestEvent): Promise<Response> {
    const body = await readJsonBody<{ amount?: unknown; confirmAmount?: unknown }>(event.request);
    const amount = Number(body.amount);
    const confirmedAmount = Number(body.confirmAmount);
    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(confirmedAmount) ||
      amount !== confirmedAmount ||
      amount < 1 ||
      amount > 1000
    ) {
      throw new EatRightError(
        "invalid_amount",
        400,
        "Enter matching amounts between ₹1 and ₹1000",
      );
    }

    const { session } = await resolveSession(event);
    const result = await remote.recharge(session, amount);
    invalidate(session);
    return json(result);
  }

  async function execute(endpoint: Endpoint, event: RequestEvent): Promise<Response> {
    switch (endpoint) {
      case "login": return login(event);
      case "disconnect":
        sessions.clear(event.cookies);
        return json({ success: true });
      case "account": return accountResponse(event);
      case "menu": return menuResponse(event);
      case "search": return search(event);
      case "orders": return orders(event);
      case "orderDetails": return orderDetails(event);
      case "placeOrder": return placeOrder(event);
      case "wallet": return wallet(event);
      case "recharge": return recharge(event);
    }
  }

  function errorResponse(error: unknown): Response {
    if (error instanceof EatRightError) {
      return json(
        {
          error: error.message,
          errorCode: error.code,
          ...(error.details ?? {}),
        },
        { status: error.status },
      );
    }
    console.error("[eatright] unexpected error", error);
    return json({ error: "Unexpected Eat Right error" }, { status: 500 });
  }

  return {
    handler(endpoint: Endpoint): RequestHandler {
      return async (event) => {
        try {
          return await execute(endpoint, event);
        } catch (error) {
          return errorResponse(error);
        }
      };
    },
    isConnected(cookies: Cookies): boolean {
      return sessions.read(cookies) !== null;
    },
  };
}
