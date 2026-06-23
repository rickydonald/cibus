import { json } from "@sveltejs/kit";
import { resolveEatRightSession } from "$lib/server/eatright";
import { DEV_MODE } from "$lib/server/dev";

const baseUrl = "https://eatright.loyolacollege.edu";

const DEV_MENU_ITEMS: Record<string, Array<{
  id: number;
  itemname: string;
  amount: number;
  available_qty: number;
  categoryname: string;
  outletname: string;
  outletid: number;
}>> = {
  "1": [
    { id: 101, itemname: "Chicken Momo - Steamed", amount: 120, available_qty: 15, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 102, itemname: "Chicken Momo - Fried", amount: 140, available_qty: 12, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 103, itemname: "Veg Momo - Steamed", amount: 100, available_qty: 20, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 104, itemname: "Veg Momo - Fried", amount: 120, available_qty: 18, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 105, itemname: "Pork Momo - Steamed", amount: 130, available_qty: 10, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 106, itemname: "Cheese Momo", amount: 150, available_qty: 8, categoryname: "Special", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 107, itemname: "Chicken Soup", amount: 80, available_qty: 10, categoryname: "Soup", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 108, itemname: "Veg Soup", amount: 60, available_qty: 15, categoryname: "Soup", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 109, itemname: "Cold Drink", amount: 40, available_qty: 50, categoryname: "Beverages", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 110, itemname: "Water Bottle", amount: 20, available_qty: 100, categoryname: "Beverages", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 111, itemname: "French Fries", amount: 90, available_qty: 25, categoryname: "Snacks", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 112, itemname: "Spring Roll", amount: 70, available_qty: 20, categoryname: "Snacks", outletname: "Momo's Kitchen", outletid: 1 },
  ],
  "2": [
    { id: 201, itemname: "King Fish Fry", amount: 160, available_qty: 8, categoryname: "Fish", outletname: "Fish Fry Center", outletid: 2 },
    { id: 202, itemname: "Fish Curry with Rice", amount: 140, available_qty: 10, categoryname: "Meals", outletname: "Fish Fry Center", outletid: 2 },
    { id: 203, itemname: "Prawn Fry", amount: 200, available_qty: 6, categoryname: "Fish", outletname: "Fish Fry Center", outletid: 2 },
    { id: 204, itemname: "Fish Biryani", amount: 180, available_qty: 8, categoryname: "Biryani", outletname: "Fish Fry Center", outletid: 2 },
    { id: 205, itemname: "Chicken Biryani", amount: 160, available_qty: 12, categoryname: "Biryani", outletname: "Fish Fry Center", outletid: 2 },
    { id: 206, itemname: "Egg Fried Rice", amount: 100, available_qty: 15, categoryname: "Rice", outletname: "Fish Fry Center", outletid: 2 },
    { id: 207, itemname: "Veg Fried Rice", amount: 90, available_qty: 18, categoryname: "Rice", outletname: "Fish Fry Center", outletid: 2 },
    { id: 208, itemname: "Fish Finger", amount: 120, available_qty: 10, categoryname: "Snacks", outletname: "Fish Fry Center", outletid: 2 },
    { id: 209, itemname: "Chilli Fish", amount: 150, available_qty: 7, categoryname: "Fish", outletname: "Fish Fry Center", outletid: 2 },
    { id: 210, itemname: "Cold Drink", amount: 40, available_qty: 40, categoryname: "Beverages", outletname: "Fish Fry Center", outletid: 2 },
    { id: 211, itemname: "Butter Milk", amount: 30, available_qty: 30, categoryname: "Beverages", outletname: "Fish Fry Center", outletid: 2 },
    { id: 212, itemname: "Curd Rice", amount: 80, available_qty: 12, categoryname: "Rice", outletname: "Fish Fry Center", outletid: 2 },
  ],
};

export async function GET({ params, cookies }) {
  const { outlet_id, shop_no } = params;

  if (DEV_MODE) {
    return json(DEV_MENU_ITEMS[outlet_id] ?? []);
  }

  const session = await resolveEatRightSession({
    cookies,
  });
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader } = session;

  const res = await fetch(
    `${baseUrl}/ajax/getItemsByOutlet.jsp?outletId=${outlet_id}&shopno=${shop_no}`,
    {
      headers: {
        Cookie: cookieHeader,
      },
    },
  );

  if (!res.ok) {
    return json({ error: "Failed to fetch items" }, { status: res.status });
  }

  const items = await res.json();

  return json(items);
}
