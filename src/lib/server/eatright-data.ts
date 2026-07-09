import * as cheerio from "cheerio";
import { TtlCache, hashCacheKey } from "./cache";

const BASE_URL = "https://eatright.loyolacollege.edu";
const PAGE_CONTROLLER_URL = `${BASE_URL}/pagecontroller.jsp`;
const USER_AGENT = "Mozilla/5.0";

export type Outlet = {
  id: number;
  name: string;
  shopNo: number;
  isClosed: boolean;
};

export type AccountSummary = {
  user: string;
  walletBalance: string;
  outlets: Outlet[];
};

export type MenuItem = {
  id: number;
  itemname: string;
  amount: number;
  available_qty: number;
  categoryname: string;
  outletname: string;
  outletid: number;
};

const accountCache = new TtlCache<AccountSummary>(20 * 1000);
const menuCache = new TtlCache<MenuItem[]>(20 * 1000);

function sessionKey(cookieHeader: string) {
  return hashCacheKey(cookieHeader);
}

function parseAccountSummary(html: string): AccountSummary {
  const $ = cheerio.load(html);

  const outlets = $(".outlet-card")
    .map((_, el) => ({
      id: Number($(el).attr("data-id") ?? 0),
      name: $(el).attr("data-name") ?? "",
      shopNo: Number($(el).attr("data-outletno") ?? 0),
      isClosed: $(el).hasClass("disabled-outlet"),
    }))
    .get()
    .filter((outlet) => outlet.id && outlet.shopNo);

  const walletBalance = parseFloat(
    $("h5.text-success")
      .text()
      .match(/₹\s*([\d]+(?:\.\d+)?)/)?.[1] ?? "0",
  ).toFixed(2);

  const user = $("#navmenu li:first-child a").text().trim();

  return { user, walletBalance, outlets };
}

export async function getAccountSummary(cookieHeader: string): Promise<AccountSummary> {
  return accountCache.getOrSet(sessionKey(cookieHeader), async () => {
    const response = await fetch(PAGE_CONTROLLER_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`EatRight account returned HTTP ${response.status}`);
    }

    return parseAccountSummary(await response.text());
  });
}

export async function getMenuItems(input: {
  cookieHeader: string;
  outletId: number | string;
  shopNo: number | string;
}): Promise<MenuItem[]> {
  const outletId = Number(input.outletId);
  const shopNo = Number(input.shopNo);

  if (!Number.isFinite(outletId) || !Number.isFinite(shopNo)) {
    return [];
  }

  const key = `${sessionKey(input.cookieHeader)}:${outletId}:${shopNo}`;

  return menuCache.getOrSet(key, async () => {
    const response = await fetch(
      `${BASE_URL}/ajax/getItemsByOutlet.jsp?outletId=${outletId}&shopno=${shopNo}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Cookie: input.cookieHeader,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`EatRight menu returned HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    return Array.isArray(data) ? data as MenuItem[] : [];
  });
}

export function clearEatRightDataCache(cookieHeader: string) {
  const key = sessionKey(cookieHeader);
  accountCache.delete(key);
  menuCache.deletePrefix(`${key}:`);
}
