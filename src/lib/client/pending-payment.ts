import { browser } from "$app/environment";

const PENDING_PAYMENT_KEY = "eatright:pending-payment";
const MAX_AGE_MS = 30 * 60 * 1000;

export type PendingPayment = {
  orderId: string;
  returnPath: string;
  startedAt: number;
};

export function setPendingPayment(orderId: string, returnPath: string) {
  if (!browser) return;
  const pending: PendingPayment = {
    orderId,
    returnPath,
    startedAt: Date.now(),
  };
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
}

export function getPendingPayment(): PendingPayment | null {
  if (!browser) return null;

  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;

    const pending = JSON.parse(raw) as Partial<PendingPayment>;
    if (
      !pending.orderId ||
      typeof pending.startedAt !== "number" ||
      Date.now() - pending.startedAt > MAX_AGE_MS
    ) {
      clearPendingPayment();
      return null;
    }

    return {
      orderId: pending.orderId,
      returnPath: pending.returnPath ?? "/view/wallet",
      startedAt: pending.startedAt,
    };
  } catch {
    clearPendingPayment();
    return null;
  }
}

export function clearPendingPayment() {
  if (!browser) return;
  sessionStorage.removeItem(PENDING_PAYMENT_KEY);
}
