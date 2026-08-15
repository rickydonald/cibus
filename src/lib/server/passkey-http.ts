export const MAX_PASSKEY_REQUEST_BYTES = 128 * 1024;

export class PasskeyRequestBodyError extends Error {
    constructor(public readonly kind: "invalid_json" | "request_too_large") {
        super(kind);
        this.name = "PasskeyRequestBodyError";
    }
}

export async function readPasskeyJsonBody(
    request: Request,
    maxBytes = MAX_PASSKEY_REQUEST_BYTES,
): Promise<Record<string, unknown>> {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
        throw new PasskeyRequestBodyError("invalid_json");
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
        if (!/^\d+$/.test(contentLengthHeader)) {
            throw new PasskeyRequestBodyError("invalid_json");
        }
        if (Number(contentLengthHeader) > maxBytes) {
            throw new PasskeyRequestBodyError("request_too_large");
        }
    }

    const reader = request.body?.getReader();
    if (!reader) throw new PasskeyRequestBodyError("invalid_json");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new PasskeyRequestBodyError("request_too_large");
        }
        chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        const value = JSON.parse(text);
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("invalid object");
        }
        return value as Record<string, unknown>;
    } catch {
        throw new PasskeyRequestBodyError("invalid_json");
    }
}

export async function readOptionalPasskeyJsonBody(
    request: Request,
    maxBytes = 1024,
): Promise<Record<string, unknown>> {
    if (!request.body) return {};
    return readPasskeyJsonBody(request, maxBytes);
}

export async function readBoundedResponseJson(
    response: Response,
    maxBytes = 64 * 1024,
): Promise<Record<string, unknown>> {
    const contentLength = response.headers.get("content-length");
    if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
        throw new Error("Passkey service response is too large");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Passkey service returned an empty response");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new Error("Passkey service response is too large");
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    try {
        const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("invalid object");
        }
        return value as Record<string, unknown>;
    } catch {
        throw new Error("Passkey service returned invalid JSON");
    }
}
