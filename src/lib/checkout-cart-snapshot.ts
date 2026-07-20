export type CheckoutCartItem = {
  id: number;
  amount: number;
  qty: number;
  outletid: number;
  outletname: string;
  shopno: number;
  itemname: string;
};

/**
 * Captures every cart field sent to the order API in a stable order so a
 * checkout recharge can never authorize a different cart implicitly.
 */
export function createCheckoutCartSnapshot(
  items: ReadonlyArray<CheckoutCartItem>,
): string {
  return JSON.stringify(
    items
      .map((item) => ({
        id: item.id,
        amount: item.amount,
        qty: item.qty,
        outletid: item.outletid,
        outletname: item.outletname,
        shopno: item.shopno,
        itemname: item.itemname,
      }))
      .sort(
        (left, right) =>
          left.outletid - right.outletid ||
          left.shopno - right.shopno ||
          left.id - right.id ||
          left.itemname.localeCompare(right.itemname),
      ),
  );
}

export function matchesCheckoutCartSnapshot(
  snapshot: string,
  items: ReadonlyArray<CheckoutCartItem>,
): boolean {
  return snapshot === createCheckoutCartSnapshot(items);
}
