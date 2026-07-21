export function createPaymentCallbackPath(returnPath: "/view/cart" | "/view/wallet") {
    const searchParams = new URLSearchParams({ return: returnPath });
    return `/view/wallet/callback?${searchParams.toString()}`;
}
