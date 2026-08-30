import * as cheerio from "cheerio";
import {
  EatRightError,
  type AccountSummary,
  type Credentials,
  type EatRightRemote,
  type MenuItem,
  type PlacedOrder,
  type RechargeResult,
  type RemoteCartItem,
  type RemoteSession,
} from "./contract";

const BASE_URL = "https://eatright.loyolacollege.edu";
const HOME_URL = `${BASE_URL}/`;
const PAGE_URL = `${BASE_URL}/pagecontroller.jsp`;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

type Fetch = typeof globalThis.fetch;

function getSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();

  const raw = response.headers.get("set-cookie");
  return raw
    ? raw.split(/,(?=\s*[A-Za-z0-9_-]+=)/).map((value) => value.trim())
    : [];
}

function toCookieHeader(cookies: string[]): string {
  return cookies.map((cookie) => cookie.split(";")[0].trim()).join("; ");
}

function mergeCookies(...groups: string[][]): string[] {
  const cookies = new Map<string, string>();
  for (const group of groups) {
    for (const cookie of group) cookies.set(cookie.split("=")[0].trim(), cookie);
  }
  return [...cookies.values()];
}

function parseJson(text: string, message: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    throw new EatRightError("eatright_invalid_response", 502, message);
  }
}

function normalizeList(payload: unknown, keys: string[] = []): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function ajaxHeaders(cookieHeader: string): Record<string, string> {
  return {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: BASE_URL,
    Referer: PAGE_URL,
    "User-Agent": USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookieHeader,
  };
}

function parseAccount(html: string): AccountSummary | null {
  const $ = cheerio.load(html);
  const user = $("#navmenu li:first-child a").text().trim();
  const outletElements = $(".outlet-card");
  if (!user && !outletElements.length) return null;

  const outlets = outletElements
    .map((_, element) => ({
      id: Number($(element).attr("data-id") ?? 0),
      name: $(element).attr("data-name") ?? "",
      shopNo: Number($(element).attr("data-outletno") ?? 0),
      isClosed: $(element).hasClass("disabled-outlet"),
    }))
    .get()
    .filter((outlet) => outlet.id && outlet.shopNo);
  const walletBalance = parseFloat(
    $("h5.text-success").text().match(/₹\s*([\d]+(?:\.\d+)?)/)?.[1] ?? "0",
  ).toFixed(2);

  return { user, walletBalance, outlets };
}

function normalizePlacedOrders(payload: unknown, cart: RemoteCartItem[]): PlacedOrder[] {
  const record = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};
  const orders = record.orders;

  if (Array.isArray(orders)) {
    return orders
      .map((order) => {
        const value = order as Record<string, unknown>;
        return {
          order_no: String(value.order_no ?? value.orderNo ?? ""),
          outletid: Number(value.outletid ?? value.outletId ?? cart[0]?.outletid),
        };
      })
      .filter((order) => order.order_no && Number.isFinite(order.outletid));
  }

  const orderNumbers = record.order_nos ?? record.orderNos ?? record.order_no ?? record.orderNo;
  const values = Array.isArray(orderNumbers)
    ? orderNumbers
    : orderNumbers
      ? [orderNumbers]
      : [];
  const outletIds = [...new Set(cart.map((item) => item.outletid))];

  return values
    .map((orderNo, index) => ({
      order_no: String(orderNo),
      outletid: Number(outletIds[index] ?? outletIds[0]),
    }))
    .filter((order) => order.order_no && Number.isFinite(order.outletid));
}

export function createEatRightHttpAdapter(
  fetchImplementation: Fetch = globalThis.fetch,
): EatRightRemote {
  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetchImplementation(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(12_000),
      });
    } catch (error) {
      console.error("[eatright] upstream request failed", error);
      throw new EatRightError(
        "eatright_unavailable",
        502,
        "Eat Right is temporarily unavailable",
      );
    }
  }

  async function readJson(
    url: string,
    init: RequestInit,
    errorMessage: string,
  ): Promise<unknown> {
    const response = await request(url, init);
    const text = await response.text();
    if (!response.ok) {
      throw new EatRightError("eatright_unavailable", 502, errorMessage);
    }
    return parseJson(text, `${errorMessage}: invalid response`);
  }

  return {
    async login(credentials: Credentials): Promise<RemoteSession> {
      const home = await request(HOME_URL, {
        headers: { Accept: "text/html", "User-Agent": USER_AGENT },
        redirect: "follow",
      });
      if (!home.ok) {
        throw new EatRightError("eatright_unavailable", 502, "Failed to load Eat Right login");
      }

      const html = await home.text();
      const csrf =
        html.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)["']/)?.[1] ??
        html.match(/value=["']([^"']+)["'][^>]*name=["']csrf_token["']/)?.[1];
      const captcha = html.match(
        /class=["'][^"']*badge[^"']*["'][^>]*>\s*(\d{3,6})\s*<\/span>/,
      )?.[1];

      if (!csrf || !captcha) {
        throw new EatRightError(
          "eatright_invalid_response",
          502,
          "Eat Right login page changed unexpectedly",
        );
      }

      const initialCookies = getSetCookies(home);
      const response = await request(`${BASE_URL}/ajax/loggedin.jsp`, {
        method: "POST",
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*",
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: toCookieHeader(initialCookies),
          Origin: BASE_URL,
          Referer: HOME_URL,
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({
          erpuserId: credentials.username,
          erpuserPwd: credentials.password,
          captcha,
          csrf_token: csrf,
        }),
      });

      const loginCookies = getSetCookies(response);
      const location = response.headers.get("location");
      const redirected = response.status >= 300 && response.status < 400;
      let landingCookies: string[] = [];
      let body: unknown = "";

      if (redirected && location) {
        const landing = await request(new URL(location, BASE_URL).toString(), {
          redirect: "manual",
          headers: {
            Cookie: toCookieHeader(mergeCookies(initialCookies, loginCookies)),
            "User-Agent": USER_AGENT,
          },
        });
        landingCookies = getSetCookies(landing);
      } else {
        const text = await response.text();
        body = response.headers.get("content-type")?.includes("application/json")
          ? parseJson(text, "Eat Right returned an invalid login response")
          : text;
      }

      const successful =
        redirected ||
        (body && typeof body === "object" && (body as Record<string, unknown>).status === "SUCCESS") ||
        (typeof body === "string" && body.toLowerCase().includes("pagecontroller"));

      if (!successful) {
        throw new EatRightError(
          "eatright_login_failed",
          401,
          "Login failed – check your user ID and password",
        );
      }

      return {
        credentials,
        cookies: toCookieHeader(mergeCookies(initialCookies, loginCookies, landingCookies)),
      };
    },

    async inspect(session: RemoteSession): Promise<AccountSummary | null> {
      const response = await request(PAGE_URL, {
        headers: { Cookie: session.cookies, "User-Agent": USER_AGENT },
        redirect: "manual",
      });
      const location = response.headers.get("location") ?? "";
      if (response.status >= 300 && response.status < 400 && /login|loggedin|index/i.test(location)) {
        return null;
      }
      if (!response.ok) {
        throw new EatRightError(
          "eatright_unavailable",
          502,
          "Failed to inspect Eat Right session",
        );
      }
      return parseAccount(await response.text());
    },

    async menu(session, outletId, shopNo): Promise<MenuItem[]> {
      const payload = await readJson(
        `${BASE_URL}/ajax/getItemsByOutlet.jsp?outletId=${encodeURIComponent(outletId)}&shopno=${encodeURIComponent(shopNo)}`,
        { headers: ajaxHeaders(session.cookies) },
        "Failed to load menu",
      );
      return Array.isArray(payload) ? payload as MenuItem[] : [];
    },

    async orders(session) {
      const payload = await readJson(
        `${BASE_URL}/ajax/getUserOrders.jsp`,
        { headers: ajaxHeaders(session.cookies) },
        "Failed to load order history",
      );
      return normalizeList(payload, ["orders", "data"]);
    },

    async orderDetails(session, orderNo, outletId) {
      return readJson(
        `${BASE_URL}/ajax/getOrderDetails.jsp?order_no=${encodeURIComponent(orderNo)}&outletid=${encodeURIComponent(outletId)}`,
        { headers: ajaxHeaders(session.cookies) },
        "Failed to load order details",
      );
    },

    async wallet(session) {
      const payload = await readJson(
        `${BASE_URL}/ajax/DepositAjax.jsp`,
        {
          method: "POST",
          headers: ajaxHeaders(session.cookies),
          body: new URLSearchParams({ action: "list" }),
        },
        "Failed to load wallet transactions",
      );
      return normalizeList(payload, ["transactions", "data"]);
    },

    async recharge(session, amount): Promise<RechargeResult> {
      const payload = await readJson(
        `${BASE_URL}/ajax/DepositAjax.jsp`,
        {
          method: "POST",
          headers: ajaxHeaders(session.cookies),
          body: new URLSearchParams({
            action: "insert",
            amount: String(amount),
            confirmAmount: String(amount),
          }),
        },
        "Failed to start wallet recharge",
      );
      if (!payload || typeof payload !== "object") {
        throw new EatRightError("eatright_invalid_response", 502, "Invalid recharge response");
      }

      const result = payload as RechargeResult;
      if (result.status === "redirect" && typeof result.url === "string") {
        const paymentUrl = new URL(result.url, BASE_URL).toString();
        const gateway = await request(paymentUrl, {
          redirect: "manual",
          headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Cookie: session.cookies,
            Referer: PAGE_URL,
            "User-Agent": USER_AGENT,
          },
        });
        result.url = gateway.headers.get("location") ?? paymentUrl;
      }
      return result;
    },

    async placeOrder(session, username, cart) {
      const payload = await readJson(
        `${BASE_URL}/ajax/placeOrder.jsp`,
        {
          method: "POST",
          headers: ajaxHeaders(session.cookies),
          body: new URLSearchParams({
            cart: JSON.stringify(cart),
            grandTotal: String(cart.reduce((total, item) => total + item.total, 0)),
            paymentStatus: "Payment Not Made",
            userid: username,
          }),
        },
        "Failed to place order",
      );
      const orders = normalizePlacedOrders(payload, cart);
      if (!orders.length) {
        throw new EatRightError(
          "eatright_invalid_response",
          502,
          "Eat Right did not return an order number",
        );
      }
      return orders;
    },

    async pay(session, orders, total) {
      const payload = await readJson(
        `${BASE_URL}/ajax/makePayment.jsp`,
        {
          method: "POST",
          headers: ajaxHeaders(session.cookies),
          body: new URLSearchParams({
            order_nos: JSON.stringify(orders.map((order) => order.order_no)),
            grand_total: String(total),
          }),
        },
        "Failed to complete wallet payment",
      );
      if (!payload || typeof payload !== "object" || (payload as Record<string, unknown>).status !== "success") {
        throw new EatRightError("payment_failed", 502, "Eat Right payment was not completed");
      }
      return payload as Record<string, unknown>;
    },
  };
}
