export const MAX_WALLET_BALANCE = 1000;

function toPaise(value: number): number {
    return Math.round(value * 100);
}

export function remainingWalletCapacity(balance: number): number {
    if (!Number.isFinite(balance)) return 0;

    return (
        Math.max(
            0,
            toPaise(MAX_WALLET_BALANCE) - toPaise(Math.max(0, balance)),
        ) / 100
    );
}

export function wouldExceedWalletLimit(
    balance: number,
    rechargeAmount: number,
): boolean {
    if (!Number.isFinite(balance) || !Number.isFinite(rechargeAmount)) {
        return true;
    }

    return toPaise(rechargeAmount) > toPaise(remainingWalletCapacity(balance));
}

export function walletLimitMessage(balance: number): string {
    const capacity = remainingWalletCapacity(balance);

    if (capacity <= 0) {
        return `Your wallet has reached the ₹${MAX_WALLET_BALANCE.toLocaleString("en-IN")} limit. Use some balance before adding money.`;
    }

    return `This recharge would exceed the ₹${MAX_WALLET_BALANCE.toLocaleString("en-IN")} wallet limit. You can add up to ₹${capacity.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}.`;
}
