export function isWalletRefund(remarks: string): boolean {
    return /\bre[\s-]?fund\b/i.test(remarks);
}

export function isValidRechargeAmount(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 1;
}
