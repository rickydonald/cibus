export function availableItemQuantity(value: unknown): number {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
        ? value
        : 0;
}
