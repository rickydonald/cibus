import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const PASSKEY_INTERNAL_PATH = "/ajax/api/passkeys.jsp";

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const RP_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export type PasskeyRelyingPartyConfig = {
    rpID: string;
    rpName: string;
    origins: string[];
};

export class PasskeyConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PasskeyConfigurationError";
    }
}

function hostnameWithoutBrackets(hostname: string): string {
    return hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;
}

export function isLoopbackHostname(hostname: string): boolean {
    const normalized = hostnameWithoutBrackets(hostname).toLowerCase();
    if (normalized === "localhost") return true;
    const ipVersion = isIP(normalized);
    if (ipVersion === 4) return normalized.split(".")[0] === "127";
    if (ipVersion === 6) {
        return normalized === "::1" || normalized === "0:0:0:0:0:0:0:1";
    }
    return false;
}

function secureOriginUrl(
    value: string,
    label: string,
    allowInsecureTransport = false,
): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new PasskeyConfigurationError(`${label} must be an absolute URL`);
    }

    if (url.username || url.password) {
        throw new PasskeyConfigurationError(`${label} must not contain credentials`);
    }
    const secure = url.protocol === "https:";
    const loopbackHttp = url.protocol === "http:" && isLoopbackHostname(url.hostname);
    const developmentHttp = url.protocol === "http:" && allowInsecureTransport;
    if (!secure && !loopbackHttp && !developmentHttp) {
        throw new PasskeyConfigurationError(
            `${label} must use HTTPS unless its host is loopback`,
        );
    }
    return url;
}

/**
 * `allowInsecureTransport` exists only so the Vite dev server can reach a
 * LAN Tomcat that has no TLS listener. Production builds never set it, so the
 * HTTPS-only rule for the credential transport is unchanged there.
 */
export function normalizePasskeyBackendBaseUrl(
    value: string | undefined,
    options: { allowInsecureTransport?: boolean } = {},
): string {
    const configured = value?.trim();
    if (!configured) {
        throw new PasskeyConfigurationError(
            "PASSKEY_FOODCOURT_API_BASE_URL or FOODCOURT_API_BASE_URL must be configured",
        );
    }

    const url = secureOriginUrl(
        configured,
        "Passkey Foodcourt API base URL",
        options.allowInsecureTransport === true,
    );
    if (url.search || url.hash) {
        throw new PasskeyConfigurationError(
            "Passkey Foodcourt API base URL must not contain a query or fragment",
        );
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${pathname === "/" ? "" : pathname}`;
}

function normalizeRpID(value: string | undefined): string {
    const rpID = value?.trim().toLowerCase() ?? "";
    if (!rpID || rpID.length > 253 || rpID.endsWith(".") || rpID.includes("..")) {
        throw new PasskeyConfigurationError("PASSKEY_RP_ID is invalid");
    }
    if (rpID === "::1") return rpID;
    if (!rpID.split(".").every((label) => RP_LABEL.test(label))) {
        throw new PasskeyConfigurationError("PASSKEY_RP_ID is invalid");
    }
    return rpID;
}

function rpIDMatchesHostname(rpID: string, hostname: string): boolean {
    const normalizedHostname = hostnameWithoutBrackets(hostname).toLowerCase();
    if (isIP(rpID) || rpID === "localhost") return normalizedHostname === rpID;
    return normalizedHostname === rpID || normalizedHostname.endsWith(`.${rpID}`);
}

export function validatePasskeyRelyingPartyConfig(input: {
    rpID?: string;
    rpName?: string;
    origins?: string;
}): PasskeyRelyingPartyConfig {
    const rpID = normalizeRpID(input.rpID);
    const rpName = input.rpName?.trim() ?? "";
    if (!rpName || rpName.length > 64 || CONTROL_CHARACTERS.test(rpName)) {
        throw new PasskeyConfigurationError("PASSKEY_RP_NAME is invalid");
    }

    const originValues = input.origins
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean) ?? [];
    if (originValues.length === 0 || originValues.length > 8) {
        throw new PasskeyConfigurationError(
            "PASSKEY_ORIGINS must contain between one and eight origins",
        );
    }

    const origins = [...new Set(originValues.map((value) => {
        const url = secureOriginUrl(value, "Passkey origin");
        if (
            url.pathname !== "/" ||
            url.search ||
            url.hash ||
            !rpIDMatchesHostname(rpID, url.hostname)
        ) {
            throw new PasskeyConfigurationError(
                "Every PASSKEY_ORIGINS entry must be an origin within PASSKEY_RP_ID",
            );
        }
        return url.origin;
    }))];

    return { rpID, rpName, origins };
}

/**
 * The Foodcourt JSP uses the secret's bytes verbatim as the HMAC key, so both
 * sides must agree on exact bytes. A raw-binary secret cannot survive a UTF-8
 * environment variable — invalid sequences become U+FFFD — so a `base64:`
 * prefix carries those bytes losslessly. Anything else is read as UTF-8 text.
 */
export function decodePasskeySecretValue(value: string): Uint8Array {
    if (!value.startsWith("base64:")) {
        return Uint8Array.from(Buffer.from(value, "utf8"));
    }

    const encoded = value.slice("base64:".length).trim();
    // Accept either alphabet, with or without padding, then canonicalise so a
    // truncated or mistyped secret fails loudly here instead of at signing time.
    const normalized = encoded
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    if (!normalized || !BASE64URL.test(normalized)) {
        throw new PasskeyConfigurationError(
            "Passkey internal secret is not valid base64",
        );
    }
    const bytes = Buffer.from(normalized, "base64url");
    if (bytes.toString("base64url") !== normalized) {
        throw new PasskeyConfigurationError(
            "Passkey internal secret is not valid base64",
        );
    }
    return Uint8Array.from(bytes);
}

export function passkeyBodyHash(rawBody: string): string {
    return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export function createPasskeyInternalSignature(input: {
    secret: string | Uint8Array;
    timestamp: string;
    nonce: string;
    rawBody: string;
}): string {
    if (!/^\d{10,16}$/.test(input.timestamp)) {
        throw new TypeError("Passkey request timestamp is invalid");
    }
    if (!BASE64URL.test(input.nonce) || input.nonce.length < 16 || input.nonce.length > 128) {
        throw new TypeError("Passkey request nonce is invalid");
    }
    const canonical = [
        input.timestamp,
        input.nonce,
        "POST",
        PASSKEY_INTERNAL_PATH,
        passkeyBodyHash(input.rawBody),
    ].join("\n");
    return createHmac("sha256", input.secret)
        .update(canonical, "utf8")
        .digest("base64url");
}

export function decodeCanonicalBase64Url(
    value: unknown,
    limits: { minBytes?: number; maxBytes: number },
): ReturnType<Uint8Array["slice"]> {
    if (
        typeof value !== "string" ||
        !BASE64URL.test(value) ||
        value.length > Math.ceil((limits.maxBytes * 4) / 3) + 2
    ) {
        throw new TypeError("Invalid base64url value");
    }
    const bytes = Buffer.from(value, "base64url");
    if (
        bytes.byteLength < (limits.minBytes ?? 1) ||
        bytes.byteLength > limits.maxBytes ||
        Buffer.from(bytes).toString("base64url") !== value
    ) {
        throw new TypeError("Invalid base64url value");
    }
    return Uint8Array.from(bytes).slice();
}

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Invalid credential response");
    }
    return value as Record<string, unknown>;
}

type PasskeyLookup = { challenge: string; credentialId: string };
type PasskeyAuthenticationLookup = PasskeyLookup & { userHandle: string };

export function extractPasskeyLookup(
    value: unknown,
    ceremony: "authentication",
): PasskeyAuthenticationLookup;
export function extractPasskeyLookup(
    value: unknown,
    ceremony: "registration",
): PasskeyLookup;
export function extractPasskeyLookup(
    value: unknown,
    ceremony: "registration" | "authentication",
): PasskeyLookup | PasskeyAuthenticationLookup {
    const credential = asRecord(value);
    const credentialId = typeof credential.id === "string" ? credential.id : "";
    decodeCanonicalBase64Url(credentialId, { maxBytes: 1023 });
    if (credential.rawId !== credentialId || credential.type !== "public-key") {
        throw new TypeError("Invalid credential response");
    }

    const response = asRecord(credential.response);
    const encodedClientData = typeof response.clientDataJSON === "string"
        ? response.clientDataJSON
        : "";
    const clientDataBytes = decodeCanonicalBase64Url(encodedClientData, { maxBytes: 4096 });
    let clientData: Record<string, unknown>;
    try {
        clientData = asRecord(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(clientDataBytes)));
    } catch {
        throw new TypeError("Invalid credential response");
    }

    const expectedType = ceremony === "registration" ? "webauthn.create" : "webauthn.get";
    const challenge = typeof clientData.challenge === "string" ? clientData.challenge : "";
    if (clientData.type !== expectedType) {
        throw new TypeError("Invalid credential response");
    }
    if (
        (Object.prototype.hasOwnProperty.call(clientData, "crossOrigin")
            && clientData.crossOrigin !== false)
        || Object.prototype.hasOwnProperty.call(clientData, "topOrigin")
    ) {
        throw new TypeError("Cross-origin passkey ceremonies are not allowed");
    }
    decodeCanonicalBase64Url(challenge, { minBytes: 16, maxBytes: 128 });
    if (ceremony === "authentication") {
        const userHandle = typeof response.userHandle === "string"
            ? response.userHandle
            : "";
        decodeCanonicalBase64Url(userHandle, { minBytes: 16, maxBytes: 64 });
        return { challenge, credentialId, userHandle };
    }
    return { challenge, credentialId };
}

export function samePasskeyUserID(left: string, right: string): boolean {
    const a = Buffer.from(left.trim().toUpperCase(), "utf8");
    const b = Buffer.from(right.trim().toUpperCase(), "utf8");
    return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

export function samePasskeyUserHandle(left: string, right: string): boolean {
    try {
        const a = Buffer.from(decodeCanonicalBase64Url(left, {
            minBytes: 16,
            maxBytes: 64,
        }));
        const b = Buffer.from(decodeCanonicalBase64Url(right, {
            minBytes: 16,
            maxBytes: 64,
        }));
        return a.byteLength === b.byteLength && timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export function normalizePasskeyName(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const name = value.trim().replace(/\s+/g, " ");
    if (!name || name.length > 64 || CONTROL_CHARACTERS.test(name)) return null;
    return name;
}
