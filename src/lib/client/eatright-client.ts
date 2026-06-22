import { goto } from "$app/navigation";

const EATRIGHT_CONNECT_ERROR_CODES = new Set([
    "eatright_session_missing",
    "eatright_session_expired",
]);

export function isEatRightConnectRequired(errorCode?: string): boolean {
    return !!errorCode && EATRIGHT_CONNECT_ERROR_CODES.has(errorCode);
}

export async function redirectIfEatRightConnectRequired(
    errorCode?: string,
): Promise<boolean> {
    if (!isEatRightConnectRequired(errorCode)) return false;
    await goto("/login");
    return true;
}

export async function fetchEatRight(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    return fetch(input, init);
}
