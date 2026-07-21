export const WALLET_TRANSACTION_PAGE_SIZE = 25;

type SortableWalletTransaction = {
    date?: string;
    sort_time?: number | string;
};

export type WalletTransactionPage<T> = {
    transactions: T[];
    page: number;
    pageSize: number;
    hasMore: boolean;
    total: number;
};

function transactionTimestamp(transaction: SortableWalletTransaction): number {
    const sortTime = Number(transaction.sort_time);
    if (Number.isFinite(sortTime)) return sortTime;

    const dateTime = Date.parse(transaction.date ?? "");
    return Number.isFinite(dateTime) ? dateTime : 0;
}

export function parseWalletTransactionPage(value: string | null): number {
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1) return 1;
    return Math.min(page, 10_000);
}

export function paginateWalletTransactions<T extends SortableWalletTransaction>(
    transactions: T[],
    page: number,
): WalletTransactionPage<T> {
    const sorted = transactions
        .map((transaction, index) => ({ transaction, index }))
        .sort(
            (left, right) =>
                transactionTimestamp(right.transaction) -
                    transactionTimestamp(left.transaction) ||
                left.index - right.index,
        )
        .map(({ transaction }) => transaction);

    const start = (page - 1) * WALLET_TRANSACTION_PAGE_SIZE;
    const end = start + WALLET_TRANSACTION_PAGE_SIZE;

    return {
        transactions: sorted.slice(start, end),
        page,
        pageSize: WALLET_TRANSACTION_PAGE_SIZE,
        hasMore: end < sorted.length,
        total: sorted.length,
    };
}
