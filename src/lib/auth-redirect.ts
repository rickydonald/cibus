const REDIRECT_BASE = "https://cibus.invalid";

export function getSafeRedirectPath(
    value: string | null | undefined,
    fallback = "/view/home",
): string {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
        return fallback;
    }

    try {
        const url = new URL(value, REDIRECT_BASE);
        if (url.origin !== REDIRECT_BASE) return fallback;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return fallback;
    }
}
