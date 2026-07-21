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

const LEGACY_CART_STORAGE_KEY = "kairos:eatright:cart";
const LEGACY_PENDING_CHECKOUT_KEY = "eatright:pending_checkout_recharge";
const CART_STORAGE_PREFIX = "kairos:eatright:cart:";
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
  private scopedUserId: string | null = null;

  private storageKey() {
    return this.scopedUserId
      ? `${CART_STORAGE_PREFIX}${encodeURIComponent(this.scopedUserId)}`
      : null;
  }

  scopeToUser(userId: string) {
    if (!browser) return;
    const normalized = userId.trim().toUpperCase();
    if (!normalized || normalized === this.scopedUserId) return;

    this.scopedUserId = normalized;
    this.items = [];
    // Never assign the old shared cart to whichever account signs in next.
    localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PENDING_CHECKOUT_KEY);
    this.load();
  }

  get userId(): string | null {
    return this.scopedUserId;
  }

  private persist() {
    if (!browser) return;
    const key = this.storageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(this.items));
  }

  private load() {
    try {
      const key = this.storageKey();
      if (!key) return;
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) return;

      this.items = parsed.filter(isCartItem);
    } catch {
      const key = this.storageKey();
      if (key) localStorage.removeItem(key);
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
   * Removes all items belonging to a specific outlet
   */
  removeByOutlet(outletName: string) {
    this.items = this.items.filter(
      (item) => item.outletname !== outletName,
    );
    this.persist();
  }

  /**
   * Method to clear the cart
   */
  clear() {
    this.items = [];
    this.persist();
  }

  disconnect() {
    if (browser) {
      const key = this.storageKey();
      if (key) localStorage.removeItem(key);
      localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
      localStorage.removeItem(LEGACY_PENDING_CHECKOUT_KEY);
    }
    this.items = [];
    this.scopedUserId = null;
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
