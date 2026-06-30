import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { DEV_MODE } from "$lib/server/dev";

const DEPOSIT_URL = "https://eatright.loyolacollege.edu/ajax/DepositAjax.jsp";

const DEV_TRANSACTIONS = [
  { date: "2026-06-22 10:30 AM", amount: 200, balance: 250, type: "CREDIT", remarks: "Online Recharge" },
  { date: "2026-06-21 02:15 PM", amount: 120, balance: 50, type: "DEBIT", remarks: "Chicken Momo - Steamed" },
];

export async function GET(event) {
  if (DEV_MODE) {
    return json({ transactions: DEV_TRANSACTIONS, walletBalance: "250.00" });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) return session.response;

  const { cookieHeader } = session;

  const form = new URLSearchParams({ action: "list" });
  const response = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: cookieHeader,
    },
    body: form.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    return json({ error: "Failed to load wallet" }, { status: response.status });
  }

  try {
    return json({ transactions: JSON.parse(text.trim()) });
  } catch {
    return json({ error: "Invalid response from EatRight" }, { status: 502 });
  }
}
