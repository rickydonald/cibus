import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { getAccountSummary, getMenuItems, type MenuItem } from "$lib/server/eatright-data";
import { DEV_MODE } from "$lib/server/dev";

type SearchResult = MenuItem & {
  shopno: number;
};

const DEV_SEARCH_ITEMS: SearchResult[] = [
  { id: 101, itemname: "Chicken Momo - Steamed", amount: 120, available_qty: 15, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1, shopno: 1 },
  { id: 102, itemname: "Chicken Momo - Fried", amount: 140, available_qty: 12, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1, shopno: 1 },
  { id: 201, itemname: "King Fish Fry", amount: 160, available_qty: 8, categoryname: "Fish", outletname: "Fish Fry Center", outletid: 2, shopno: 2 },
  { id: 202, itemname: "Fish Curry with Rice", amount: 140, available_qty: 10, categoryname: "Meals", outletname: "Fish Fry Center", outletid: 2, shopno: 2 },
];

export async function GET(event) {
  const q = event.url.searchParams.get("q")?.trim();
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

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  const { accessToken } = session;

  const { outlets } = await getAccountSummary(accessToken);
  const openOutlets = outlets.filter((outlet) => !outlet.isClosed);

  const menus = await Promise.all(
    openOutlets.map((outlet) =>
      getMenuItems({
        accessToken,
        outletId: outlet.id,
        shopNo: outlet.shopNo,
      }).catch(() => []),
    ),
  );

  const query = q.toLowerCase();
  const results: SearchResult[] = [];

  for (let i = 0; i < openOutlets.length; i++) {
    const outlet = openOutlets[i];
    const items = menus[i];

    for (const item of items) {
      if (item.itemname.toLowerCase().includes(query)) {
        results.push({ ...item, shopno: outlet.shopNo });
      }
    }
  }

  return json({ results });
}
