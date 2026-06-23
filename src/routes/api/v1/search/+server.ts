import { json } from "@sveltejs/kit";
import { resolveEatRightSession } from "$lib/server/eatright";
import { DEV_MODE } from "$lib/server/dev";
import * as cheerio from "cheerio";

const BASE_URL = "https://eatright.loyolacollege.edu";
const UA = "Mozilla/5.0";

type Outlet = {
  id: number;
  name: string;
  shopNo: number;
};

type MenuItem = {
  id: number;
  itemname: string;
  amount: number;
  available_qty: number;
  categoryname: string;
  outletname: string;
  outletid: number;
};

type SearchResult = MenuItem & {
  shopno: number;
};

const DEV_SEARCH_ITEMS: SearchResult[] = [
  { id: 101, itemname: "Chicken Momo - Steamed", amount: 120, available_qty: 15, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1, shopno: 1 },
  { id: 102, itemname: "Chicken Momo - Fried", amount: 140, available_qty: 12, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1, shopno: 1 },
  { id: 201, itemname: "King Fish Fry", amount: 160, available_qty: 8, categoryname: "Fish", outletname: "Fish Fry Center", outletid: 2, shopno: 2 },
  { id: 202, itemname: "Fish Curry with Rice", amount: 140, available_qty: 10, categoryname: "Meals", outletname: "Fish Fry Center", outletid: 2, shopno: 2 },
];

async function getOutlets(cookieHeader: string): Promise<Outlet[]> {
  const res = await fetch(`${BASE_URL}/pagecontroller.jsp`, {
    headers: { "User-Agent": UA, Cookie: cookieHeader },
  });
  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);

  return $(".outlet-card")
    .map((_, el) => ({
      id: Number($(el).attr("data-id") ?? 0),
      name: $(el).attr("data-name") ?? "",
      shopNo: Number($(el).attr("data-outletno") ?? 0),
    }))
    .get()
    .filter((o) => o.id && o.shopNo);
}

async function fetchMenuItems(
  outletId: number,
  shopNo: number,
  cookieHeader: string,
): Promise<MenuItem[]> {
  const res = await fetch(
    `${BASE_URL}/ajax/getItemsByOutlet.jsp?outletId=${outletId}&shopno=${shopNo}`,
    { headers: { Cookie: cookieHeader } },
  );
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET({ url, cookies }) {
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return json({ results: [] });
  }

  if (DEV_MODE) {
    const query = q.toLowerCase();
    return json({
      results: DEV_SEARCH_ITEMS.filter((item) =>
        item.itemname.toLowerCase().includes(query),
      ),
    });
  }

  const session = await resolveEatRightSession({ cookies });
  if (!session.ok) return session.response;

  const { cookieHeader } = session;

  const outlets = await getOutlets(cookieHeader);

  const menus = await Promise.all(
    outlets.map((o) => fetchMenuItems(o.id, o.shopNo, cookieHeader)),
  );

  const query = q.toLowerCase();
  const results: SearchResult[] = [];

  for (let i = 0; i < outlets.length; i++) {
    const outlet = outlets[i];
    const items = menus[i];

    for (const item of items) {
      if (item.itemname.toLowerCase().includes(query)) {
        results.push({ ...item, shopno: outlet.shopNo });
      }
    }
  }

  return json({ results });
}
