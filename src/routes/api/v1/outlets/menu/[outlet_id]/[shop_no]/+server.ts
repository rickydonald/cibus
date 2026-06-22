import { json } from "@sveltejs/kit";
import { resolveEatRightSession } from "$lib/server/eatright";

const baseUrl = "https://eatright.loyolacollege.edu";

export async function GET({ params, cookies }) {
  const session = await resolveEatRightSession({
    cookies,
  });
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader } = session;
  const { outlet_id, shop_no } = params;

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
