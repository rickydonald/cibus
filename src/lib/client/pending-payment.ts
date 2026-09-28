const PENDING_PAYMENT_KEY = "eatright:pending-payment";
const MAX_AGE_MS = 30 * 60 * 1000;

export type PendingPayment = {
  orderId: string;
  returnPath: string;
  startedAt: number;
};

function availableStorage(name: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return typeof window === "undefined" ? null : window[name];
  } catch {
    return null;
  }
}

export function setPendingPayment(
  orderId: string,
  returnPath: string,
): PendingPayment | null {
  const pending: PendingPayment = {
    orderId,
    returnPath,
    startedAt: Date.now(),
  };

  for (const storage of [
    availableStorage("localStorage"),
    availableStorage("sessionStorage"),
  ]) {
    try {
      storage?.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending));
      if (storage) return pending;
    } catch {
      // Fall back to the next browser storage option.
    }
  }

  return null;
}

export function getPendingPayment(): PendingPayment | null {
  for (const storage of [
    availableStorage("localStorage"),
    availableStorage("sessionStorage"),
  ]) {
    try {
      const raw = storage?.getItem(PENDING_PAYMENT_KEY);
      if (!raw) continue;

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

  return null;
}

export function clearPendingPayment() {
  for (const storage of [
    availableStorage("localStorage"),
    availableStorage("sessionStorage"),
  ]) {
    try {
      storage?.removeItem(PENDING_PAYMENT_KEY);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }
}
