import { json } from "@sveltejs/kit";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import { clearEatRightDataCache, getAccountSummary, getWalletTransactions } from "$lib/server/eatright-data";
import { DEV_MODE } from "$lib/server/dev";
import { FOODCOURT_API_BASE_URL, foodcourtApiRequest, FoodcourtApiError } from "$lib/server/foodcourt-api";

const DEV_TRANSACTIONS = [
  { date: "2026-06-22 10:30 AM", amount: 200, balance: 250, sort_time: 1719045000, type: "CREDIT", remarks: "Online Recharge" },
  { date: "2026-06-21 02:15 PM", amount: 120, balance: 50, sort_time: 1718958000, type: "DEBIT", remarks: "Chicken Momo - Steamed" },
  { date: "2026-06-20 12:00 PM", amount: 50, balance: 170, sort_time: 1718870400, type: "CREDIT", remarks: "Online Recharge" },
];

export async function GET(event) {
  if (DEV_MODE) {
    return json({ transactions: DEV_TRANSACTIONS, walletBalance: "250.00" });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) {
    return session.response;
  }

  try {
    const [transactions, account] = await Promise.all([
      getWalletTransactions(session.accessToken),
      getAccountSummary(session.accessToken),
    ]);
    return json({ transactions, walletBalance: account.walletBalance });
  } catch (error) {
    const status = error instanceof FoodcourtApiError ? error.status : 502;
    const message = error instanceof FoodcourtApiError ? error.message : "Failed to load wallet transactions";
    return json({ error: message }, { status });
  }
}

export async function POST(event) {
  const { request } = event;
  const { amount, confirmAmount, returnPath } = await request.json();
  const depositAmount = Number(amount);
  const confirmedAmount = Number(confirmAmount);
  const safeReturnPath = returnPath === "/view/cart" ? "/view/cart" : "/view/wallet";

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

  if (DEV_MODE) {
    return json({ status: "success", message: "Dev recharge successful" });
  }

  const session = await resolveEatRightSessionFromEvent(event);
  if (!session.ok) {
    return session.response;
  }

  const { accessToken } = session;

  const form = new URLSearchParams({
    action: "insert",
    amount: String(depositAmount),
    confirmAmount: String(confirmedAmount),
    returnPath: safeReturnPath,
  });

  let data: unknown;
  try {
    data = await foodcourtApiRequest<unknown>("/ajax/DepositAjax.jsp", {
      accessToken,
      method: "POST",
      body: form,
    });
  } catch (error) {
    const status = error instanceof FoodcourtApiError ? error.status : 502;
    const message = error instanceof FoodcourtApiError
      ? error.message
      : "Failed to start wallet recharge";
    return json({ error: message }, { status });
  }

  if (!data || typeof data !== "object") {
    return json({ error: "Foodcourt returned an invalid recharge response" }, { status: 502 });
  }

  const result = data as Record<string, unknown>;

  if (result.status === "redirect" && typeof result.url === "string") {
    const apiBase = new URL(`${FOODCOURT_API_BASE_URL}/`);
    const returnedUrl = result.url.trim();
    let paymentUrl: string;

    try {
      const parsedUrl = new URL(returnedUrl, apiBase);
      const basePath = apiBase.pathname.replace(/\/$/, "");

      // Legacy JSPs may include the servlet context path even though the
      // configured API base already contains it. Avoid /foodcourtapi twice.
      if (returnedUrl.startsWith(`${basePath}/`)) {
        paymentUrl = new URL(returnedUrl, apiBase.origin).toString();
      } else if (parsedUrl.origin === apiBase.origin) {
        paymentUrl = returnedUrl.startsWith("/")
          ? new URL(`${basePath}${returnedUrl}`, apiBase.origin).toString()
          : parsedUrl.toString();
      } else {
        return json({ error: "Foodcourt returned an invalid payment URL" }, { status: 502 });
      }
    } catch {
      return json({ error: "Foodcourt returned an invalid payment URL" }, { status: 502 });
    }

    // Register the app's payment callback with the backend: after the
    // gateway responds, Responsepayload.jsp redirects the user here
    // instead of the JSP page flow.
    const appCallback = `${event.url.origin}/view/wallet/callback?return=${encodeURIComponent(safeReturnPath)}`;
    paymentUrl += `${paymentUrl.includes("?") ? "&" : "?"}app_callback=${encodeURIComponent(appCallback)}`;

    // The client also needs the order id so it can verify the payment by
    // polling, even when the gateway's return redirect never reaches this
    // app (e.g. local dev, where the gateway returns to the production
    // domain).
    let orderId: string | null = null;
    try {
      orderId = new URL(paymentUrl).searchParams.get("orderid");
    } catch {
      orderId = null;
    }

    let gatewayResponse: Response;
    try {
      gatewayResponse = await fetch(paymentUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "manual",
      });
    } catch {
      return json(
        { error: "Unable to reach the Foodcourt payment service" },
        { status: 502 },
      );
    }
    const gatewayText = await gatewayResponse.text();

    const gatewayLocation = gatewayResponse.headers.get("location");
    if (gatewayResponse.status >= 300 && gatewayResponse.status < 400 && gatewayLocation) {
      let redirectUrl: URL;
      try {
        redirectUrl = new URL(gatewayLocation, paymentUrl);
      } catch {
        return json({ error: "Payment gateway returned an invalid redirect" }, { status: 502 });
      }
      if (redirectUrl.protocol !== "https:") {
        return json({ error: "Payment gateway returned an insecure redirect" }, { status: 502 });
      }
      clearEatRightDataCache(accessToken);
      return json({ status: "redirect", url: redirectUrl.toString(), orderId });
    }

    const gatewayError = gatewayText
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    return json(
      { error: gatewayError || `Payment gateway initiation failed with HTTP ${gatewayResponse.status}` },
      { status: 502 },
    );
  }

  clearEatRightDataCache(accessToken);
  return json(result);
}
