import {
    browserSupportsWebAuthn,
    startAuthentication,
    startRegistration,
} from "@simplewebauthn/browser";

type AuthenticationOptionsJSON = Parameters<
    typeof startAuthentication
>[0]["optionsJSON"];
type RegistrationOptionsJSON = Parameters<
    typeof startRegistration
>[0]["optionsJSON"];

/**
 * Accounts are limited to a single passkey. The authoritative check lives in
 * the Foodcourt JSP (PASSKEY_MAX_ACTIVE_CREDENTIALS), inside the transaction
 * that inserts the credential; this mirror only keeps the UI from offering a
 * setup flow that would reach the device prompt and then fail with a 409.
 */
export const MAX_PASSKEYS_PER_ACCOUNT = 1;

export type PasskeySummary = {
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
    backupEligible: boolean;
    backupState: boolean;
};

export type PasskeyAuthenticationResult = {
    success: true;
    name: string;
    userid: string;
};

type PasskeyAction = "authenticate" | "register" | "revoke" | "list";

export class PasskeyApiError extends Error {
    readonly status: number;
    readonly errorCode?: string;

    constructor(
        message: string,
        status: number,
        errorCode?: string,
    ) {
        super(message);
        this.name = "PasskeyApiError";
        this.status = status;
        this.errorCode = errorCode;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

async function apiRequest<T>(
    path: string,
    init: RequestInit,
    fallbackError: string,
): Promise<T> {
    let response: Response;
    try {
        response = await fetch(path, {
            ...init,
            cache: "no-store",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                ...init.headers,
            },
        });
    } catch {
        throw new PasskeyApiError(
            "Unable to reach the passkey service. Check your connection and try again.",
            0,
            "network_error",
        );
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
        const error = isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : fallbackError;
        const errorCode = isRecord(payload) && typeof payload.errorCode === "string"
            ? payload.errorCode
            : undefined;
        throw new PasskeyApiError(error, response.status, errorCode);
    }

    return payload as T;
}

function postJson<T>(
    path: string,
    body: unknown,
    fallbackError: string,
): Promise<T> {
    return apiRequest<T>(
        path,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        fallbackError,
    );
}

export function supportsPasskeys(): boolean {
    try {
        return browserSupportsWebAuthn();
    } catch {
        return false;
    }
}

export async function authenticateWithPasskey(): Promise<PasskeyAuthenticationResult> {
    const optionsJSON = await postJson<AuthenticationOptionsJSON>(
        "/api/v1/passkeys/authenticate/options",
        {},
        "Unable to start passkey sign-in.",
    );
    const response = await startAuthentication({ optionsJSON });
    const result = await postJson<PasskeyAuthenticationResult>(
        "/api/v1/passkeys/authenticate/verify",
        response,
        "Unable to verify this passkey.",
    );

    if (!result?.success || !result.userid) {
        throw new PasskeyApiError(
            "The passkey could not be verified. Try again or use your password.",
            401,
            "passkey_verification_failed",
        );
    }
    return result;
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
    const payload = await apiRequest<{ passkeys?: unknown }>(
        "/api/v1/passkeys",
        { method: "GET" },
        "Unable to load your passkeys.",
    );
    return Array.isArray(payload?.passkeys)
        ? payload.passkeys as PasskeySummary[]
        : [];
}

export async function registerPasskey(input: {
    currentPassword: string;
    name: string;
}): Promise<PasskeySummary> {
    const name = input.name.trim();
    const optionsJSON = await postJson<RegistrationOptionsJSON>(
        "/api/v1/passkeys/register/options",
        { currentPassword: input.currentPassword },
        "Unable to start passkey setup.",
    );
    const response = await startRegistration({ optionsJSON });
    const payload = await postJson<{ passkey?: PasskeySummary }>(
        "/api/v1/passkeys/register/verify",
        { response, name },
        "Unable to save this passkey.",
    );

    if (!payload?.passkey) {
        throw new PasskeyApiError(
            "The passkey was created but its details could not be loaded. Refresh and check again.",
            502,
            "passkey_response_invalid",
        );
    }
    return payload.passkey;
}

export async function revokePasskey(input: {
    credentialId: string;
    currentPassword: string;
}): Promise<void> {
    await postJson<unknown>(
        "/api/v1/passkeys/revoke",
        input,
        "Unable to remove this passkey.",
    );
}

export function getPasskeyErrorMessage(
    error: unknown,
    action: PasskeyAction,
): string {
    if (error instanceof PasskeyApiError) return error.message;

    const errorName = isRecord(error) && typeof error.name === "string"
        ? error.name
        : "";
    const errorCode = isRecord(error) && typeof error.code === "string"
        ? error.code
        : "";

    if (errorName === "NotAllowedError") {
        return action === "authenticate"
            ? "Passkey sign-in was cancelled or timed out. Try again or use your password."
            : "Passkey setup was cancelled or timed out. Nothing was changed.";
    }
    if (errorName === "InvalidStateError") {
        return "This passkey is already linked to your account. Try another device or passkey provider.";
    }
    if (
        errorCode ===
        "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT"
    ) {
        return "This device or security key can't create a passkey that works without a user ID. Try another device or passkey provider.";
    }
    if (
        errorCode === "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT" ||
        errorCode === "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE"
    ) {
        return "This device couldn't verify you with a fingerprint, face, or PIN. Try another device or security key.";
    }
    if (errorName === "ConstraintError") {
        return "This device couldn't meet Eat Right's passkey security requirements. Try another device or security key.";
    }
    if (errorName === "NotSupportedError") {
        return "This browser or device cannot use the requested passkey. Try an updated browser or another device.";
    }
    if (errorName === "SecurityError") {
        return "Passkeys are unavailable on this connection. Open Eat Right over a secure HTTPS connection.";
    }
    if (errorName === "AbortError" || errorCode === "ERROR_CEREMONY_ABORTED") {
        return "The passkey request was cancelled. Please try again.";
    }

    if (action === "authenticate") {
        return "Unable to sign in with a passkey. Try again or use your password.";
    }
    if (action === "register") {
        return "Unable to create the passkey. No changes were made.";
    }
    if (action === "revoke") {
        return "Unable to remove the passkey. Please try again.";
    }
    return "Unable to load your passkeys. Please try again.";
}

export function formatPasskeyDate(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
}

/**
 * Same date without the year while it is still the current one. A passkey row
 * has one short line for both its sync state and its date, and "2026" is the
 * one part of that line a reader can already infer.
 */
export function formatPasskeyDateCompact(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        ...(date.getFullYear() === new Date().getFullYear()
            ? {}
            : { year: "numeric" as const }),
    }).format(date);
}
