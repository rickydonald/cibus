import { randomBytes } from "node:crypto";
import {
    createPasskeyInternalSignature,
    PASSKEY_INTERNAL_PATH,
} from "./passkey-core";
import type { PasskeyRuntimeConfig } from "./passkey-config";
import { readBoundedResponseJson } from "./passkey-http";

const USER_LOGIN_PATH = "/ajax/api/userLogin.jsp";
const PASSKEY_API_TIMEOUT_MS = 12_000;

export type PasskeyAction =
    | "registration_context"
    | "store_challenge"
    | "verify_challenge"
    | "registration_complete"
    | "list"
    | "revoke"
    | "authentication_context"
    | "authentication_complete";

export class PasskeyApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly action: PasskeyAction | "reauthenticate",
        public readonly backendStatus?: string,
        public readonly retryAfterSeconds?: number,
    ) {
        super("Passkey service request failed");
        this.name = "PasskeyApiError";
    }
}

export async function passkeyApiRequest<T extends Record<string, unknown>>(
    config: PasskeyRuntimeConfig,
    action: PasskeyAction,
    payload: Record<string, unknown> = {},
    accessToken?: string,
): Promise<T> {
    if (Object.hasOwn(payload, "action")) {
        throw new TypeError("Passkey API payload must not override its action");
    }
    const rawBody = JSON.stringify({ action, ...payload });
    const timestamp = String(Date.now());
    const nonce = randomBytes(24).toString("base64url");
    const signature = createPasskeyInternalSignature({
        secret: config.internalSecret,
        timestamp,
        nonce,
        rawBody,
    });
    const headers = new Headers({
        Accept: "application/json",
        "Content-Type": "application/json; charset=UTF-8",
        "X-Passkey-Timestamp": timestamp,
        "X-Passkey-Nonce": nonce,
        "X-Passkey-Signature": signature,
    });
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    let response: Response;
    try {
        response = await fetch(`${config.backendBaseUrl}${PASSKEY_INTERNAL_PATH}`, {
            method: "POST",
            headers,
            body: rawBody,
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(PASSKEY_API_TIMEOUT_MS),
        });
    } catch {
        throw new PasskeyApiError(502, action);
    }

    let responsePayload: Record<string, unknown>;
    try {
        responsePayload = await readBoundedResponseJson(response);
    } catch {
        throw new PasskeyApiError(response.ok ? 502 : response.status, action);
    }
    if (!response.ok) {
        const backendStatus = typeof responsePayload.status === "string"
            && /^[A-Z][A-Z0-9_]{0,63}$/.test(responsePayload.status)
            ? responsePayload.status
            : undefined;
        throw new PasskeyApiError(response.status, action, backendStatus);
    }
    return responsePayload as T;
}

/** Password reauthentication deliberately uses the passkey-only HTTPS base. */
export async function passkeyPasswordLogin(
    config: PasskeyRuntimeConfig,
    userID: string,
    password: string,
): Promise<Record<string, unknown>> {
    const form = new URLSearchParams({ erpuserId: userID, erpuserPwd: password });
    let response: Response;
    try {
        response = await fetch(`${config.backendBaseUrl}${USER_LOGIN_PATH}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            body: form.toString(),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(PASSKEY_API_TIMEOUT_MS),
        });
    } catch {
        throw new PasskeyApiError(502, "reauthenticate");
    }

    let payload: Record<string, unknown>;
    try {
        payload = await readBoundedResponseJson(response, 32 * 1024);
    } catch {
        throw new PasskeyApiError(response.ok ? 502 : response.status, "reauthenticate");
    }
    if (!response.ok) {
        const backendStatus = typeof payload.status === "string"
            && /^[A-Z][A-Z0-9_]{0,63}$/.test(payload.status)
            ? payload.status
            : undefined;
        const retryValue = typeof payload.retryAfterSeconds === "number"
            ? payload.retryAfterSeconds
            : Number(response.headers.get("retry-after"));
        const retryAfterSeconds = Number.isSafeInteger(retryValue)
            && retryValue >= 1
            && retryValue <= 600
            ? retryValue
            : undefined;
        throw new PasskeyApiError(
            response.status,
            "reauthenticate",
            backendStatus,
            retryAfterSeconds,
        );
    }
    return payload;
}
