import { json } from "@sveltejs/kit";
import { resolveEatRightSession } from "$lib/server/eatright";

const BASE_URL = "https://eatright.loyolacollege.edu";
const DEPOSIT_URL = `${BASE_URL}/ajax/DepositAjax.jsp`;
const REFERER = `${BASE_URL}/pagecontroller.jsp`;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

function eatRightHeaders(cookieHeader: string) {
  return {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "https://eatright.loyolacollege.edu",
    Referer: REFERER,
    "User-Agent": USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookieHeader,
  };
}

function parseEatRightJson(text: string) {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

export async function GET({ cookies }) {
  const session = await resolveEatRightSession({
    cookies,
  });
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader } = session;
  const form = new URLSearchParams({ action: "list" });
  const response = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: eatRightHeaders(cookieHeader),
    body: form.toString(),
  });

  const text = await response.text();

  if (!response.ok) {
    return json(
      {
        error: "Failed to load wallet transactions",
        response: text,
      },
      { status: response.status },
    );
  }

  const data = parseEatRightJson(text);
  if (!data) {
    return json(
      {
        error: "EatRight returned an invalid wallet response",
        response: text,
      },
      { status: 502 },
    );
  }

  return json({ transactions: Array.isArray(data) ? data : [] });
}

export async function POST({ request, cookies }) {
  const session = await resolveEatRightSession({
    cookies,
  });
  if (!session.ok) {
    return session.response;
  }

  const { cookieHeader } = session;
  const { amount, confirmAmount } = await request.json();
  const depositAmount = Number(amount);
  const confirmedAmount = Number(confirmAmount);

  if (
    !Number.isFinite(depositAmount) ||
    !Number.isFinite(confirmedAmount) ||
    depositAmount !== confirmedAmount ||
    depositAmount < 1 ||
    depositAmount > 1000
  ) {
    return json(
      {
        error: "Enter matching amounts between ₹1 and ₹1000",
        errorCode: "invalid_amount",
      },
      { status: 400 },
    );
  }

  const form = new URLSearchParams({
    action: "insert",
    amount: String(depositAmount),
    confirmAmount: String(confirmedAmount),
  });

  const response = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: eatRightHeaders(cookieHeader),
    body: form.toString(),
  });

  const text = await response.text();

  if (!response.ok) {
    return json(
      {
        error: "Failed to start wallet recharge",
        response: text,
      },
      { status: response.status },
    );
  }

  const data = parseEatRightJson(text);
  if (!data || typeof data !== "object") {
    return json(
      {
        error: "EatRight returned an invalid recharge response",
        response: text,
      },
      { status: 502 },
    );
  }

  const result = data as Record<string, unknown>;

  if (result.status === "redirect" && typeof result.url === "string") {
    const paymentUrl = `${BASE_URL}${result.url.startsWith("/") ? "" : "/"}${result.url}`;

    const gatewayResponse = await fetch(paymentUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
        Cookie: cookieHeader,
        Referer: REFERER,
      },
      redirect: "manual",
    });

    const gatewayLocation = gatewayResponse.headers.get("location");
    if (gatewayResponse.status >= 300 && gatewayResponse.status < 400 && gatewayLocation) {
      return json({ status: "redirect", url: gatewayLocation });
    }

    return json({ status: "redirect", url: paymentUrl });
  }

  return json(result);
}
