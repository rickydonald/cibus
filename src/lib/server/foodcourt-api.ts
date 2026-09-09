import { env } from "$env/dynamic/private";

const FOODCOURT_API_TIMEOUT_MS = 15_000;

export class FoodcourtApiError extends Error {
    status: number;
    payload: unknown;

    constructor(
        message: string,
        status: number,
        payload: unknown,
    ) {
        super(message);
        this.name = "FoodcourtApiError";
        this.status = status;
        this.payload = payload;
    }
}

export function getFoodcourtApiBaseUrl(): string {
    const value = env.FOODCOURT_API_BASE_URL?.trim();
    if (!value) {
        throw new FoodcourtApiError("Foodcourt API is not configured", 503, null);
    }

    try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)
            || url.username || url.password || url.search || url.hash) {
            throw new Error("Invalid API base URL");
        }
    } catch {
        throw new FoodcourtApiError("Foodcourt API configuration is invalid", 503, null);
    }
    return value.replace(/\/+$/, "");
}

function parsePayload(text: string): unknown {
    if (!text.trim()) return null;
    try {
        return JSON.parse(text.trim());
    } catch {
        return text;
    }
}

export async function foodcourtApiRequest<T>(
    path: string,
    options: {
        accessToken?: string;
        method?: "GET" | "POST";
        body?: URLSearchParams;
    } = {},
): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });
    if (options.accessToken) {
        headers.set("Authorization", `Bearer ${options.accessToken}`);
    }
    if (options.body) {
        headers.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    }

    const response = await fetch(officialApiUrl(path), {
        method: options.method ?? "GET",
        headers,
        body: options.body?.toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(FOODCOURT_API_TIMEOUT_MS),
    });
    const payload = parsePayload(await response.text());

    if (!response.ok) {
        const value = payload && typeof payload === "object"
            ? payload as Record<string, unknown>
            : null;
        throw new FoodcourtApiError(
            String(value?.message ?? `Foodcourt API returned HTTP ${response.status}`),
            response.status,
            payload,
        );
    }

    return payload as T;
}

export function officialApiUrl(path: string): string {
    return `${getFoodcourtApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
