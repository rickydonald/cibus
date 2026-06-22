import { browser } from "$app/environment";

export type CartItem = {
  id: number;
  itemname: string;
  amount: number;
  qty: number;
  outletid: number;
  outletname: string;
  shopno: number;
  available_qty: number;
};

const CART_STORAGE_KEY = "kairos:eatright:cart";
export const MAX_QTY = 10;

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "number" &&
    typeof item.itemname === "string" &&
    typeof item.amount === "number" &&
    typeof item.qty === "number" &&
    typeof item.outletid === "number" &&
    typeof item.outletname === "string" &&
    typeof item.shopno === "number" &&
    item.qty > 0
  );
}

/**
 * CartStore contains util functions to handle cart and cart items
 */
class CartStore {
  items = $state<CartItem[]>([]);

  constructor() {
    if (browser) {
      this.load();
    }
  }

  private persist() {
    if (!browser) return;

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
  }

  private load() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) return;

      this.items = parsed.filter(isCartItem);
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }

  private getItem(itemId: number, outletId: number) {
    return this.items.find(
      (item) => item.id === itemId && item.outletid === outletId,
    );
  }

  /**
   * Method to add item to the cart
   * @param item 
   * @returns 
   */
  add(item: Omit<CartItem, "qty">) {
    const existing = this.getItem(item.id, item.outletid);

    if (existing) {
      const limit = Math.min(
        MAX_QTY,
        Math.max(1, existing.available_qty || MAX_QTY),
      );

      if (existing.qty >= limit) return;

      existing.qty += 1;
      this.persist();
      return;
    }

    this.items.push({
      ...item,
      qty: 1,
      available_qty: Math.max(
        1,
        Math.min(item.available_qty ?? MAX_QTY, MAX_QTY),
      ),
    });

    this.persist();
  }

  /**
   * Method to remove item from the cart
   * @param itemId 
   * @param outletId 
   * @returns 
   */
  remove(itemId: number, outletId: number) {
    const existing = this.getItem(itemId, outletId);

    if (!existing) return;

    if (existing.qty > 1) {
      existing.qty -= 1;
    } else {
      this.items = this.items.filter(
        (item) =>
          !(item.id === itemId && item.outletid === outletId),
      );
    }

    this.persist();
  }

  /**
   * Method to set the quantity of the cart
   * @param itemId 
   * @param outletId 
   * @param quantity 
   * @returns 
   */
  setQuantity(itemId: number, outletId: number, quantity: number) {
    const item = this.getItem(itemId, outletId);

    if (!item) return;

    const limit = Math.min(MAX_QTY, item.available_qty);

    if (quantity <= 0) {
      this.remove(itemId, outletId);
      return;
    }

    item.qty = Math.min(quantity, limit);
    this.persist();
  }

  /**
   * Method to clear the cart
   */
  clear() {
    this.items = [];
    this.persist();
  }

  /**
   * Method to calculate and get total items in the cart
   */
  get totalItems(): number {
    return this.items.reduce((total, item) => total + item.qty, 0);
  }

  /**
   * Method to calculate and get total amount value of the cart
   */
  get totalAmount(): number {
    return this.items.reduce(
      (total, item) => total + item.amount * item.qty,
      0,
    );
  }

  /**
   * Method to list items by outlet
   */
  get groupedByOutlet(): Record<string, CartItem[]> {
    return Object.groupBy(
      this.items,
      (item) => item.outletname,
    ) as Record<string, CartItem[]>;
  }
}

/** Exportig the CartStore */
export const cart = new CartStore();