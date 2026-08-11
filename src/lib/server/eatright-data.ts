import { TtlCache, hashCacheKey } from "./cache";
import type { EatRightAuthSession } from "./eatright";
import { foodcourtApiRequest } from "./foodcourt-api";

export type Outlet = {
  id: number;
  name: string;
  shopNo: number;
  isClosed: boolean;
};

export type AccountSummary = {
  name: string;
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

export type WalletTransactionPage = {
  transactions: WalletTransaction[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  total: number;
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
const walletTransactionsCache = new TtlCache<WalletTransactionPage>(20 * 1000);

function sessionKey(accessToken: string) {
  return hashCacheKey(accessToken);
}

/**
 * Method to get account summary of an user
 * @param auth 
 * @returns 
 */
export async function getAccountSummary(auth: EatRightAuthSession): Promise<AccountSummary> {
  const { accessToken, name, userid } = auth;
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
      name,
      userid,
      walletBalance: Number(user.walletBalance ?? 0).toFixed(2),
      outlets,
    };
  });
}

/**
 * Method to get Wallet Transactions
 * @param accessToken 
 * @returns 
 */
export async function getWalletTransactions(
  accessToken: string,
  page: number,
): Promise<WalletTransactionPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const cacheKey = `${sessionKey(accessToken)}:${safePage}`;
  return walletTransactionsCache.getOrSet(cacheKey, async () => {
    const payload = await foodcourtApiRequest<unknown>(
      `/ajax/api/getUserWalletTransactions.jsp?page=${safePage}&pageSize=25`,
      { accessToken },
    );
    if (payload && typeof payload === "object") {
      const value = payload as Record<string, unknown>;
      const transactions = Array.isArray(value.transactions)
        ? value.transactions as WalletTransaction[]
        : [];
      const pagination = value.pagination && typeof value.pagination === "object"
        ? value.pagination as Record<string, unknown>
        : {};
      return {
        transactions,
        page: Number(pagination.page ?? safePage),
        pageSize: Number(pagination.pageSize ?? 25),
        hasMore: pagination.hasMore === true,
        total: Number(pagination.total ?? transactions.length),
      };
    }
    return { transactions: [], page: safePage, pageSize: 25, hasMore: false, total: 0 };
  });
}

/**
 * Method to get Menu Items
 * @param input 
 * @returns 
 */
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

/**
 * Method to Clear Eat Right Data Cache
 * @param accessToken 
 */
export function clearEatRightDataCache(accessToken: string) {
  const key = sessionKey(accessToken);
  accountCache.delete(key);
  menuCache.deletePrefix(`${key}:`);
  walletTransactionsCache.deletePrefix(`${key}:`);
}
