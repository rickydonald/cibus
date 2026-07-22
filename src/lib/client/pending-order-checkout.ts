import { browser } from "$app/environment";
import { CHECKOUT_ID_PATTERN, createCheckoutId } from "$lib/checkout-id";

const STORAGE_PREFIX = "eatright:order-checkout:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type PendingOrderCheckout = {
  checkoutId: string;
  cartSnapshot: string;
  createdAt: number;
};

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId.trim().toUpperCase())}`;
}

export function getOrCreatePendingOrderCheckout(
  userId: string,
  cartSnapshot: string,
): string {
  if (!browser) throw new Error("Checkout can only be created in the browser");

  const key = storageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const pending = JSON.parse(raw) as Partial<PendingOrderCheckout>;
      if (
        typeof pending.checkoutId === "string" &&
        CHECKOUT_ID_PATTERN.test(pending.checkoutId) &&
        pending.cartSnapshot === cartSnapshot &&
        typeof pending.createdAt === "number" &&
        Date.now() - pending.createdAt < MAX_AGE_MS
      ) {
        return pending.checkoutId;
      }
    }
  } catch {
    // Replace malformed or stale browser state below.
  }

  const checkoutId = createCheckoutId();
  localStorage.setItem(key, JSON.stringify({
    checkoutId,
    cartSnapshot,
    createdAt: Date.now(),
  } satisfies PendingOrderCheckout));
  return checkoutId;
}

export function clearPendingOrderCheckout(userId: string | null | undefined) {
  if (!browser || !userId) return;
  localStorage.removeItem(storageKey(userId));
}
