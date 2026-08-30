export type Credentials = {
  username: string;
  password: string;
};

export type RemoteSession = {
  credentials: Credentials;
  cookies: string;
};

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

export type CartItem = MenuItem & {
  qty: number;
  shopno: number;
};

export type RemoteCartItem = {
  id: number;
  name: string;
  qty: number;
  price: number;
  total: number;
  shopno: number;
  outletid: number;
};

export type PlacedOrder = {
  order_no: string;
  outletid: number;
};

export type RechargeResult = Record<string, unknown> & {
  status?: string;
  url?: string;
};

export type EatRightRemote = {
  login(credentials: Credentials): Promise<RemoteSession>;
  /** Returns account data when authenticated, or null for an expired session. */
  inspect(session: RemoteSession): Promise<AccountSummary | null>;
  menu(session: RemoteSession, outletId: number, shopNo: number): Promise<MenuItem[]>;
  orders(session: RemoteSession): Promise<Array<Record<string, unknown>>>;
  orderDetails(session: RemoteSession, orderNo: string, outletId: string): Promise<unknown>;
  wallet(session: RemoteSession): Promise<unknown[]>;
  recharge(session: RemoteSession, amount: number): Promise<RechargeResult>;
  placeOrder(
    session: RemoteSession,
    username: string,
    cart: RemoteCartItem[],
  ): Promise<PlacedOrder[]>;
  pay(session: RemoteSession, orders: PlacedOrder[], total: number): Promise<Record<string, unknown>>;
};

export type Endpoint =
  | "login"
  | "disconnect"
  | "account"
  | "menu"
  | "search"
  | "orders"
  | "orderDetails"
  | "placeOrder"
  | "wallet"
  | "recharge";

export type ErrorCode =
  | "invalid_json"
  | "invalid_input"
  | "missing_parameters"
  | "cart_empty"
  | "cart_invalid"
  | "invalid_amount"
  | "eatright_session_missing"
  | "eatright_session_expired"
  | "eatright_login_failed"
  | "eatright_unavailable"
  | "eatright_invalid_response"
  | "order_partially_placed"
  | "payment_failed"
  | "order_not_recorded";

export class EatRightError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EatRightError";
  }
}
