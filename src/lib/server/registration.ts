import { FOODCOURT_API_BASE_URL } from "$lib/server/foodcourt-api";

export const REGISTRATION_SESSION_COOKIE = "CibusRegistrationSession";

export type RegistrationUserType = "student" | "staff" | "guest";
export type RegistrationPayload = Record<string, unknown>;

export class RegistrationApiError extends Error {
    constructor(
        public status: number,
        public payload: RegistrationPayload,
    ) {
        super(String(payload.message ?? payload.status ?? "Registration service failed"));
        this.name = "RegistrationApiError";
    }
}

function parsePayload(text: string): RegistrationPayload {
    if (!text.trim()) return {};
    try {
        const value = JSON.parse(text.trim());
        return value && typeof value === "object" && !Array.isArray(value)
            ? value as RegistrationPayload
            : {};
    } catch {
        return {};
    }
}

function extractSessionId(headers: Headers): string | null {
    const extendedHeaders = headers as Headers & { getSetCookie?: () => string[] };
    const values = extendedHeaders.getSetCookie?.()
        ?? (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
    for (const value of values) {
        const match = value.match(/(?:^|[,;]\s*)JSESSIONID=([^;,\s]+)/i);
        if (match?.[1] && /^[A-Za-z0-9_-]{16,128}$/.test(match[1])) return match[1];
    }
    return null;
}

export async function foodcourtRegistrationRequest(
    path: "/ajax/registerUser.jsp" | "/ajax/verifyOtp.jsp" | "/ajax/GuestController.jsp",
    form: URLSearchParams,
    backendSessionId?: string,
): Promise<{ payload: RegistrationPayload; sessionId: string | null }> {
    const headers = new Headers({
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    });
    if (backendSessionId && /^[A-Za-z0-9_-]{16,128}$/.test(backendSessionId)) {
        headers.set("Cookie", `JSESSIONID=${backendSessionId}`);
    }

    const response = await fetch(`${FOODCOURT_API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: form.toString(),
        cache: "no-store",
        redirect: "error",
    });
    const payload = parsePayload(await response.text());
    const sessionId = extractSessionId(response.headers);

    if (!response.ok) throw new RegistrationApiError(response.status, payload);
    return { payload, sessionId };
}

export function validateRegistrationInput(input: {
    userType: unknown;
    identifier: unknown;
    mobile: unknown;
}): { ok: true; userType: RegistrationUserType; identifier: string; mobile: string }
    | { ok: false; message: string } {
    if (input.userType !== "student" && input.userType !== "staff" && input.userType !== "guest") {
        return { ok: false, message: "Choose a valid account type" };
    }

    const userType = input.userType;
    const identifier = String(input.identifier ?? "").trim();
    const mobile = String(input.mobile ?? "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(mobile)) {
        return { ok: false, message: "Enter a valid 10-digit Indian mobile number" };
    }

    if (userType === "guest") {
        if (identifier.length < 2 || identifier.length > 80) {
            return { ok: false, message: "Enter your full name" };
        }
        return { ok: true, userType, identifier, mobile };
    }

    const normalizedIdentifier = identifier.toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._/-]{1,49}$/.test(normalizedIdentifier)) {
        return { ok: false, message: "Enter a valid college ID" };
    }
    return { ok: true, userType, identifier: normalizedIdentifier, mobile };
}

export function registrationStatusError(statusValue: unknown): { message: string; status: number } {
    const status = String(statusValue ?? "ERROR").toUpperCase();
    if (status === "NOT_FOUND") return { message: "The ID and mobile number do not match college records", status: 404 };
    if (status === "ALREADY_REGISTERED") return { message: "This account is already registered. Please sign in.", status: 409 };
    if (status === "EXISTS") return { message: "This mobile number is already registered", status: 409 };
    if (status === "INVALID_MOBILE" || status === "INVALID_INPUT") return { message: "The registration details are invalid", status: 400 };
    if (status === "SMS_FAILED") return { message: "Unable to send the OTP. Please try again.", status: 502 };
    if (status === "OTP_EXPIRED") return { message: "The OTP has expired. Request a new code.", status: 410 };
    if (status === "SESSION_EXPIRED") return { message: "The verification session expired. Request a new code.", status: 410 };
    if (status === "INVALID" || status === "INVALID_OTP") return { message: "The OTP is incorrect", status: 400 };
    return { message: "Unable to complete registration", status: 502 };
}
