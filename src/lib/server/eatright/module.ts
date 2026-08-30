import { createHash } from "node:crypto";
import {
  json,
  type Cookies,
  type RequestEvent,
  type RequestHandler,
} from "@sveltejs/kit";
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

/**
 * Eat Right application module
 *
 * This is the SvelteKit-facing deep module for the Eat Right integration.
 * Route callers only use the small `EatRightModule` interface at the bottom of
 * this file. Everything else is private implementation.
 *
 * Read the file in this order:
 *
 * 1. Dependencies and small in-process helpers.
 * 2. Session lifecycle and cached reads inside `createEatRightModule`.
 * 3. One `handle*` function per supported endpoint.
 * 4. The dispatcher and public interface returned at the bottom.
 *
 * Normal protected-request flow:
 *
 * request -> decrypt session -> inspect/renew session -> run operation
 *         -> normalize result -> return JSON
 *
 * Order mutation flow (ordering matters):
 *
 * validate cart -> group by outlet/shop -> place groups sequentially
 *               -> pay once -> invalidate caches -> confirm in history
 *
 * The injected `EatRightRemote` is the only true-external seam. The production
 * HTTP adapter and fixture adapter both satisfy it. Session encoding, caching,
 * validation, orchestration, and error presentation stay hidden here.
 */

const SESSION_ACCOUNT_TTL_MS = 20_000;
const MENU_CACHE_TTL_MS = 20_000;
const ORDER_HISTORY_ATTEMPTS = 3;
const ORDER_HISTORY_DELAY_MS = 700;

type Dependencies = {
  /** Adapter at the true-external Eat Right seam. */
  remote: EatRightRemote;
  /** Secret used to encrypt authenticated session cookies. */
  sessionSecret: string;
  /** Must be true for HTTPS production deployments. */
  secureCookies: boolean;
  /** Injected only to make expiration deterministic in tests. */
  now?: () => number;
  /** Injected only to avoid real polling delays in tests. */
  sleep?: (milliseconds: number) => Promise<void>;
};

/**
 * The complete interface presented to routes and interface-level tests.
 *
 * - `handler` translates a named endpoint into a SvelteKit request handler.
 * - `isConnected` performs a local cookie check for server-side redirects; it
 *   does not contact Eat Right or prove the upstream session is still valid.
 */
export type EatRightModule = {
  handler(endpoint: Endpoint): RequestHandler;
  isConnected(cookies: Cookies): boolean;
};

// In-process implementation helpers ---------------------------------------

type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

class TimedCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number,
  ) { }

  get(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > this.now()) return existing.value;

    // Cache the in-flight promise as well as the result. Concurrent callers
    // therefore share one upstream request instead of starting duplicates.
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
  // Raw upstream cookies never become cache keys or appear in diagnostics.
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
    [item.id, item.qty, item.price, item.total, item.shopno, item.outletid].every(
      Number.isFinite,
    ) &&
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

// Module factory -----------------------------------------------------------

/**
 * Creates an isolated Eat Right module from explicit dependencies.
 *
 * Production composes this once in `index.ts`. Tests create fresh instances
 * with the fixture adapter, a deterministic clock, and a no-op sleep function.
 * No caller needs to know how sessions, scraping, caching, or ordering work.
 */
export function createEatRightModule({
  remote,
  sessionSecret,
  secureCookies,
  now = Date.now,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: Dependencies): EatRightModule {
  const sessions = createSessionCodec(sessionSecret, secureCookies);
  // One inspection proves authentication and returns the account page data.
  // This avoids fetching pagecontroller.jsp once to validate and again to parse.
  const accountCache = new TimedCache<AccountSummary | null>(
    SESSION_ACCOUNT_TTL_MS,
    now,
  );
  const menuCache = new TimedCache<MenuItem[]>(MENU_CACHE_TTL_MS, now);

  // Session lifecycle and cached reads -------------------------------------

  function invalidateSessionData(session: RemoteSession): void {
    const prefix = `${sessionKey(session)}:`;
    accountCache.deletePrefix(prefix);
    menuCache.deletePrefix(prefix);
  }

  /**
   * Resolves an authenticated session for a protected endpoint.
   *
   * Account inspection is cached briefly and doubles as authentication proof.
   * A stale session is reauthenticated exactly once with the encrypted
   * credentials. Only rejected authentication clears the cookie; upstream
   * outages preserve it so a temporary failure cannot disconnect the user.
   */
  async function resolveAuthenticatedSession(event: RequestEvent): Promise<{
    session: RemoteSession;
    account: AccountSummary;
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

    const account = await loadAccount(current);
    if (account) {
      return { session: current, account, reauthenticated: false };
    }

    invalidateSessionData(current);
    let renewed: RemoteSession;
    try {
      renewed = await remote.login(current.credentials);
    } catch (error) {
      if (!(error instanceof EatRightError) || error.code === "eatright_login_failed") {
        sessions.clear(event.cookies);
        throw new EatRightError(
          "eatright_session_expired",
          401,
          "Eat Right session expired. Please reconnect your account.",
        );
      }
      throw error;
    }

    const renewedAccount = await loadAccount(renewed);
    if (!renewedAccount) {
      sessions.clear(event.cookies);
      throw new EatRightError(
        "eatright_session_expired",
        401,
        "Eat Right session expired. Please reconnect your account.",
      );
    }
    sessions.write(event.cookies, renewed);
    return {
      session: renewed,
      account: renewedAccount,
      reauthenticated: true,
    };
  }

  function loadAccount(session: RemoteSession): Promise<AccountSummary | null> {
    const key = sessionKey(session);
    return accountCache.get(`${key}:account`, () => remote.inspect(session));
  }

  function loadMenu(
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

  // Endpoint implementations ----------------------------------------------

  async function handleLogin(event: RequestEvent): Promise<Response> {
    const body = await readJsonBody<{ userId?: string; password?: string }>(
      event.request,
    );
    const username = body.userId?.trim();
    if (!username || !body.password) {
      throw new EatRightError(
        "invalid_input",
        400,
        "userId and password are required",
      );
    }

    const session = await remote.login({ username, password: body.password });
    const account = await loadAccount(session);
    if (!account) {
      invalidateSessionData(session);
      throw new EatRightError(
        "eatright_login_failed",
        401,
        "Login failed – check your user ID and password",
      );
    }
    sessions.write(event.cookies, session);
    return json({ success: true, redirectUrl: "/view/home" });
  }

  async function handleAccount(event: RequestEvent): Promise<Response> {
    const resolved = await resolveAuthenticatedSession(event);
    return json({
      ...resolved.account,
      reauthenticated: resolved.reauthenticated,
    });
  }

  async function handleMenu(event: RequestEvent): Promise<Response> {
    const outletId = Number(event.params.outlet_id);
    const shopNo = Number(event.params.shop_no);
    if (!Number.isFinite(outletId) || !Number.isFinite(shopNo)) {
      throw new EatRightError("invalid_input", 400, "Invalid outlet or shop number");
    }
    const { session } = await resolveAuthenticatedSession(event);
    return json(await loadMenu(session, outletId, shopNo));
  }

  async function handleSearch(event: RequestEvent): Promise<Response> {
    const query = event.url.searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return json({ results: [] });

    const { session, account } = await resolveAuthenticatedSession(event);
    const openOutlets = account.outlets.filter(
      (outlet) => !outlet.isClosed,
    );
    const menus = await Promise.all(
      openOutlets.map((outlet) =>
        loadMenu(session, outlet.id, outlet.shopNo).catch(() => []),
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

  async function handleOrders(event: RequestEvent): Promise<Response> {
    const { session } = await resolveAuthenticatedSession(event);
    return json(
      { orders: await remote.orders(session) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  async function handleOrderDetails(event: RequestEvent): Promise<Response> {
    const orderNo = event.url.searchParams.get("order_no");
    const outletId = event.url.searchParams.get("outletid");
    if (!orderNo || !outletId) {
      throw new EatRightError(
        "missing_parameters",
        400,
        "Order number and outlet id are required",
      );
    }
    const { session } = await resolveAuthenticatedSession(event);
    return json(await remote.orderDetails(session, orderNo, outletId));
  }

  /**
   * Places and pays for a cart as one application workflow.
   *
   * Eat Right accepts one outlet/shop group per placement request, so groups
   * are placed sequentially before a single wallet payment. If a later group
   * fails, the error includes already-created orders instead of pretending the
   * mutation was atomic. Successful payment is confirmed against history.
   */
  async function handlePlaceOrder(event: RequestEvent): Promise<Response> {
    const body = await readJsonBody<{ cart?: CartItem[] }>(event.request);
    if (!Array.isArray(body.cart) || !body.cart.length) {
      throw new EatRightError("cart_empty", 400, "Cart is empty");
    }

    const cart = toRemoteCart(body.cart);
    if (!validCart(cart)) {
      throw new EatRightError("cart_invalid", 400, "Cart contains invalid items");
    }

    const { session } = await resolveAuthenticatedSession(event);
    const placedOrders: PlacedOrder[] = [];
    try {
      for (const group of groupCart(cart)) {
        placedOrders.push(
          ...await remote.placeOrder(
            session,
            session.credentials.username,
            group,
          ),
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
    invalidateSessionData(session);

    const expected = new Set(placedOrders.map((order) => order.order_no));
    let isRecorded = false;
    for (let attempt = 0; attempt < ORDER_HISTORY_ATTEMPTS; attempt += 1) {
      const history = await remote.orders(session).catch(() => []);
      const found = new Set(
        history.map((order) => String(order.order_no ?? order.orderNo ?? "")),
      );
      if ([...expected].every((orderNo) => found.has(orderNo))) {
        isRecorded = true;
        break;
      }
      if (attempt < ORDER_HISTORY_ATTEMPTS - 1) {
        await sleep(ORDER_HISTORY_DELAY_MS);
      }
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
          `order_no=${encodeURIComponent(order.order_no)}` +
          `&outletid=${encodeURIComponent(order.outletid)}`,
        )
        .join("&")}`,
    });
  }

  async function handleWallet(event: RequestEvent): Promise<Response> {
    const { session } = await resolveAuthenticatedSession(event);
    return json({ transactions: await remote.wallet(session) });
  }

  async function handleRecharge(event: RequestEvent): Promise<Response> {
    const body = await readJsonBody<{
      amount?: unknown;
      confirmAmount?: unknown;
    }>(event.request);
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

    const { session } = await resolveAuthenticatedSession(event);
    const result = await remote.recharge(session, amount);
    invalidateSessionData(session);
    return json(result);
  }

  // Dispatcher and error presenter ----------------------------------------

  async function dispatch(
    endpoint: Endpoint,
    event: RequestEvent,
  ): Promise<Response> {
    switch (endpoint) {
      case "login":
        return handleLogin(event);
      case "disconnect":
        sessions.clear(event.cookies);
        return json({ success: true });
      case "account":
        return handleAccount(event);
      case "menu":
        return handleMenu(event);
      case "search":
        return handleSearch(event);
      case "orders":
        return handleOrders(event);
      case "orderDetails":
        return handleOrderDetails(event);
      case "placeOrder":
        return handlePlaceOrder(event);
      case "wallet":
        return handleWallet(event);
      case "recharge":
        return handleRecharge(event);
    }
  }

  function presentError(error: unknown): Response {
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

  // Public interface -------------------------------------------------------

  return {
    /** Returns the complete SvelteKit handler for one named endpoint. */
    handler(endpoint: Endpoint): RequestHandler {
      return async (event) => {
        try {
          return await dispatch(endpoint, event);
        } catch (error) {
          return presentError(error);
        }
      };
    },
    /** Local cookie presence check used only by server-side redirect guards. */
    isConnected(cookies: Cookies): boolean {
      return sessions.read(cookies) !== null;
    },
  };
}
