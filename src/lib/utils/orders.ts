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
    const normalized = /^\d{4}-\d{2}-\d{2} /.test(value)
        ? value.replace(" ", "T")
        : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

// "1:25 pm", or "" when the source string carries no clock time.
export function orderTime(order: EatRightOrder): string {
    const date = parseOrderDate(order.created_on);
    if (!date || !/\d{1,2}:\d{2}/.test(order.created_on ?? "")) return "";
    return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(
        date,
    );
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
