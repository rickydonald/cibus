import type {
  EatRightRemote,
  MenuItem,
  PlacedOrder,
  RemoteSession,
} from "./contract";

const menu: Record<number, MenuItem[]> = {
  1: [
    { id: 101, itemname: "Chicken Momo - Steamed", amount: 120, available_qty: 15, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 102, itemname: "Chicken Momo - Fried", amount: 140, available_qty: 12, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
    { id: 103, itemname: "Veg Momo - Steamed", amount: 100, available_qty: 20, categoryname: "Momo", outletname: "Momo's Kitchen", outletid: 1 },
  ],
  2: [
    { id: 201, itemname: "King Fish Fry", amount: 160, available_qty: 8, categoryname: "Fish", outletname: "Fish Fry Center", outletid: 2 },
    { id: 202, itemname: "Fish Curry with Rice", amount: 140, available_qty: 10, categoryname: "Meals", outletname: "Fish Fry Center", outletid: 2 },
  ],
};

export function createEatRightFixtureAdapter(): EatRightRemote {
  let orderSequence = 2;
  const orderHistory: Array<Record<string, unknown>> = [
    {
      order_no: "DEV-001",
      outletid: "1",
      outletname: "Momo's Kitchen",
      grand_total: 240,
      order_status: "Delivered",
    },
  ];

  return {
    async login(credentials): Promise<RemoteSession> {
      return { credentials, cookies: "fixture-session=active" };
    },
    async validate() {
      return true;
    },
    async account() {
      return {
        user: "Dev User (DEV001)",
        walletBalance: "250.00",
        outlets: [
          { id: 1, name: "Momo's Kitchen", shopNo: 1, isClosed: false },
          { id: 2, name: "Fish Fry Center", shopNo: 2, isClosed: false },
        ],
      };
    },
    async menu(_session, outletId) {
      return menu[outletId] ?? [];
    },
    async orders() {
      return orderHistory;
    },
    async orderDetails(_session, orderNo, outletId) {
      return {
        order_no: orderNo,
        outletid: outletId,
        order_status: "Delivered",
        grand_total: 240,
        items: [{ id: 101, itemname: "Chicken Momo - Steamed", amount: 120, qty: 2 }],
      };
    },
    async wallet() {
      return [
        { date: "2026-06-22 10:30 AM", amount: 200, balance: 250, sort_time: 1719045000, type: "CREDIT", remarks: "Online Recharge" },
        { date: "2026-06-21 02:15 PM", amount: 120, balance: 50, sort_time: 1718958000, type: "DEBIT", remarks: "Chicken Momo - Steamed" },
      ];
    },
    async recharge(_session, amount) {
      return { status: "success", message: `Added ₹${amount}` };
    },
    async placeOrder(_session, _username, cart): Promise<PlacedOrder[]> {
      const placed = {
        order_no: `DEV-${String(orderSequence++).padStart(3, "0")}`,
        outletid: cart[0]?.outletid ?? 1,
      };
      orderHistory.unshift({
        ...placed,
        outletname: "Fixture Outlet",
        grand_total: cart.reduce((total, item) => total + item.total, 0),
        order_status: "Paid",
      });
      return [placed];
    },
    async pay() {
      return { status: "success" };
    },
  };
}
