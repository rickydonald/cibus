import { browser } from "$app/environment";

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
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pending.checkoutId) &&
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

  const checkoutId = crypto.randomUUID();
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
