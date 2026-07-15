import { env } from "$env/dynamic/private";

export const FOODCOURT_API_BASE_URL = (
    env.FOODCOURT_API_BASE_URL ?? "http://10.2.154.27:8080/foodcourtapi"
).replace(/\/$/, "");

export class FoodcourtApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public payload: unknown,
    ) {
        super(message);
        this.name = "FoodcourtApiError";
    }
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

    const response = await fetch(`${FOODCOURT_API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body?.toString(),
        cache: "no-store",
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
    return `${FOODCOURT_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
