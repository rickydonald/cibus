import { TtlCache, hashCacheKey } from "./cache";
import { foodcourtApiRequest } from "./foodcourt-api";

export type Outlet = {
  id: number;
  name: string;
  shopNo: number;
  isClosed: boolean;
};

export type AccountSummary = {
  user: string;
  userid: string;
  walletBalance: string;
  outlets: Outlet[];
};

export type WalletTransaction = {
  date: string;
  amount: number;
  balance: number;
  type: string;
  remarks: string;
  sort_time?: number;
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

type UserResponse = {
  success: boolean;
  name?: string;
  uid?: string;
  userid?: string;
  walletBalance?: number | string;
};

type OutletResponse = {
  id: number | string;
  outlet_name: string;
  shopno: number | string;
  is_available: boolean;
};

const accountCache = new TtlCache<AccountSummary>(20 * 1000);
const menuCache = new TtlCache<MenuItem[]>(20 * 1000);

function sessionKey(accessToken: string) {
  return hashCacheKey(accessToken);
}

export async function getAccountSummary(accessToken: string): Promise<AccountSummary> {
  return accountCache.getOrSet(sessionKey(accessToken), async () => {
    const [user, outletPayload] = await Promise.all([
      foodcourtApiRequest<UserResponse>("/ajax/api/getUser.jsp", { accessToken }),
      foodcourtApiRequest<OutletResponse[]>("/ajax/getOutlets.jsp", { accessToken }),
    ]);
    const outlets = (Array.isArray(outletPayload) ? outletPayload : []).map((outlet) => ({
      id: Number(outlet.id),
      name: String(outlet.outlet_name ?? ""),
      shopNo: Number(outlet.shopno),
      isClosed: outlet.is_available === false,
    }));

    return {
      user: user.name || "User",
      userid: user.uid ?? user.userid ?? "",
      walletBalance: Number(user.walletBalance ?? 0).toFixed(2),
      outlets,
    };
  });
}

export async function getWalletTransactions(accessToken: string): Promise<WalletTransaction[]> {
  const payload = await foodcourtApiRequest<unknown>("/ajax/api/getUserWalletTransactions.jsp", {
    accessToken,
  });
  if (Array.isArray(payload)) return payload as WalletTransaction[];
  if (payload && typeof payload === "object") {
    const transactions = (payload as Record<string, unknown>).transactions;
    if (Array.isArray(transactions)) return transactions as WalletTransaction[];
  }
  return [];
}

export async function getMenuItems(input: {
  accessToken: string;
  outletId: number | string;
  shopNo: number | string;
}): Promise<MenuItem[]> {
  const outletId = Number(input.outletId);
  const shopNo = Number(input.shopNo);
  if (!Number.isFinite(outletId) || !Number.isFinite(shopNo)) return [];

  const key = `${sessionKey(input.accessToken)}:${outletId}:${shopNo}`;
  return menuCache.getOrSet(key, async () => {
    const payload = await foodcourtApiRequest<MenuItem[]>(
      `/ajax/getItemsByOutlet.jsp?outletId=${encodeURIComponent(outletId)}&shopno=${encodeURIComponent(shopNo)}`,
      { accessToken: input.accessToken },
    );
    return Array.isArray(payload) ? payload : [];
  });
}

export function clearEatRightDataCache(accessToken: string) {
  const key = sessionKey(accessToken);
  accountCache.delete(key);
  menuCache.deletePrefix(`${key}:`);
}
