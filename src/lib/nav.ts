// Top-level "hub" routes that show the bottom tab bar.
// Detail flows (order, cart, confirmation) use back-button headers instead.
export const HUB_ROUTES = [
    "/view/home",
    "/view/search",
    "/view/history",
    "/view/wallet",
] as const;

export function isHubRoute(pathname: string): boolean {
    return HUB_ROUTES.some(
        (route) => pathname === route || pathname === `${route}/`,
    );
}
