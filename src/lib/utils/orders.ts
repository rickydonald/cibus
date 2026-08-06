export type EatRightOrder = {
    order_no: string;
    order_status: string;
    created_on: string;
    payment_status: string;
    outletid: string;
    delivered: string;
    grand_total: number;
    outletname: string;
};

export type OrderState =
    | "cancelled"
    | "delivered"
    | "payment-pending"
    | "preparing";

export const ORDER_TIME_ZONE = "Asia/Kolkata";

const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function orderState(order: EatRightOrder): OrderState {
    const status = order.order_status?.toUpperCase() ?? "";
    const payment = order.payment_status?.toUpperCase() ?? "";

    if (
        status === "CANCELLED" ||
        payment === "CANCELLED" ||
        payment === "FAILED"
    ) {
        return "cancelled";
    }
    if (order.delivered?.toUpperCase() === "Y") return "delivered";
    if (payment === "PENDING") return "payment-pending";
    return "preparing";
}

export function isActiveOrder(order: EatRightOrder): boolean {
    const state = orderState(order);
    return state === "preparing" || state === "payment-pending";
}

export function parseOrderDate(value?: string | null): Date | null {
    if (!value) return null;

    const source = value.trim();
    const backendDate = source.match(
        /^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
    );
    if (backendDate) {
        const [, day, month, year, hour = "0", minute = "0", second = "0", period] =
            backendDate;
        return indiaDate(
            Number(year),
            Number(month),
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
            period,
        );
    }

    const sqlDate = source.match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/,
    );
    if (sqlDate) {
        const [, year, month, day, hour = "0", minute = "0", second = "0"] = sqlDate;
        return indiaDate(
            Number(year),
            Number(month),
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
        );
    }

    const date = new Date(source);
    return Number.isNaN(date.getTime()) ? null : date;
}

function indiaDate(
    year: number,
    month: number,
    day: number,
    sourceHour: number,
    minute: number,
    second: number,
    period?: string,
): Date | null {
    let hour = sourceHour;
    if (period) {
        if (hour < 1 || hour > 12) return null;
        hour = hour % 12 + (period.toUpperCase() === "PM" ? 12 : 0);
    }

    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59 ||
        second < 0 ||
        second > 59
    ) {
        return null;
    }

    const wallTime = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (
        wallTime.getUTCFullYear() !== year ||
        wallTime.getUTCMonth() !== month - 1 ||
        wallTime.getUTCDate() !== day
    ) {
        return null;
    }

    return new Date(wallTime.getTime() - INDIA_OFFSET_MS);
}

// "1:25 pm", or "" when the source string carries no clock time.
export function orderTime(order: EatRightOrder): string {
    const date = parseOrderDate(order.created_on);
    if (!date || !/\d{1,2}:\d{2}/.test(order.created_on ?? "")) return "";
    return new Intl.DateTimeFormat("en-IN", {
        timeStyle: "short",
        timeZone: ORDER_TIME_ZONE,
    }).format(date);
}

// Counter pickup code — the last three digits of the order number,
// matching what the confirmation page prints under the barcode.
export function pickupCode(orderNo: string): string {
    const match = orderNo.match(/(\d{3})$/);
    return match?.[1] ?? orderNo.slice(-3);
}

export function confirmationUrl(order: EatRightOrder): string {
    return `/view/confirmation?order_no=${encodeURIComponent(order.order_no)}&outletid=${encodeURIComponent(order.outletid)}`;
}
