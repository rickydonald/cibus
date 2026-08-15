import { json, type RequestEvent, type RequestHandler } from "@sveltejs/kit";
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
    type AuthenticationResponseJSON,
    type AuthenticatorTransportFuture,
    type COSEAlgorithmIdentifier,
    type RegistrationResponseJSON,
    type WebAuthnCredential,
} from "@simplewebauthn/server";
import { cose, decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";
import {
    clearEatRightSessionCookie,
    resolveEatRightSessionFromEvent,
    setEatRightSessionCookie,
    verifyEatRightAccessToken,
    type EatRightAuthSession,
} from "./eatright";
import { EatRightAuthConfigurationError } from "./eatright-jwt";
import {
    decodeCanonicalBase64Url,
    extractPasskeyLookup,
    normalizePasskeyName,
    PasskeyConfigurationError,
    samePasskeyUserHandle,
    samePasskeyUserID,
} from "./passkey-core";
import {
    getPasskeyRuntimeConfig,
    type PasskeyRuntimeConfig,
} from "./passkey-config";
import {
    passkeyApiRequest,
    PasskeyApiError,
    passkeyPasswordLogin,
} from "./passkey-api";
import {
    PasskeyRequestBodyError,
    readOptionalPasskeyJsonBody,
    readPasskeyJsonBody,
} from "./passkey-http";
import {
    DEFAULT_RATE_LIMIT_WINDOW_MS,
    enforceRateLimits,
} from "./rate-limit";

const NO_STORE = { "Cache-Control": "no-store" };
const SUPPORTED_ALGORITHMS = [-7, -257] satisfies COSEAlgorithmIdentifier[];
const VALID_TRANSPORTS = new Set<AuthenticatorTransportFuture>([
    "ble",
    "cable",
    "hybrid",
    "internal",
    "nfc",
    "smart-card",
    "usb",
]);

class InvalidPasskeyServiceResponseError extends Error {
    constructor() {
        super("Invalid passkey service response");
        this.name = "InvalidPasskeyServiceResponseError";
    }
}

class PasskeyReauthenticationRejectedError extends Error {
    constructor() {
        super("Passkey reauthentication rejected");
        this.name = "PasskeyReauthenticationRejectedError";
    }
}

class PasskeyReauthenticationRateLimitedError extends Error {
    constructor(public readonly retryAfterSeconds: number) {
        super("Passkey reauthentication rate limited");
        this.name = "PasskeyReauthenticationRateLimitedError";
    }
}

class PasskeyAccountDisabledError extends Error {
    constructor() {
        super("Passkey account disabled");
        this.name = "PasskeyAccountDisabledError";
    }
}

function errorResponse(status: number, error: string, errorCode: string) {
    return json({ error, errorCode }, { status, headers: NO_STORE });
}

function bodyErrorResponse(error: unknown): Response {
    if (
        error instanceof PasskeyRequestBodyError &&
        error.kind === "request_too_large"
    ) {
        return errorResponse(413, "Passkey request is too large", "request_too_large");
    }
    return errorResponse(400, "Invalid passkey request", "invalid_json");
}

function configurationErrorResponse(error: unknown): Response | null {
    if (
        error instanceof PasskeyConfigurationError ||
        error instanceof EatRightAuthConfigurationError
    ) {
        console.error(error.message);
        return errorResponse(
            503,
            "Passkey service is not configured",
            "passkey_service_unavailable",
        );
    }
    return null;
}

function logPasskeyFailure(context: string, error: unknown) {
    const kind = error instanceof PasskeyApiError
        ? `${error.name}:${error.status}:${error.action}`
        : error instanceof Error
            ? error.name
            : "UnknownError";
    console.error(`${context}: ${kind}`);
}

function requireBackendSuccess(payload: Record<string, unknown>) {
    if (payload.success !== true) throw new InvalidPasskeyServiceResponseError();
}

function currentPasswordFrom(body: Record<string, unknown>): string | null {
    const password = typeof body.currentPassword === "string" ? body.currentPassword : "";
    return password.length >= 1 && password.length <= 128 ? password : null;
}

function normalizeTransports(value: unknown): AuthenticatorTransportFuture[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > 8) {
        throw new InvalidPasskeyServiceResponseError();
    }
    const transports: AuthenticatorTransportFuture[] = [];
    for (const item of value) {
        if (typeof item !== "string" || !VALID_TRANSPORTS.has(item as AuthenticatorTransportFuture)) {
            throw new InvalidPasskeyServiceResponseError();
        }
        const transport = item as AuthenticatorTransportFuture;
        if (!transports.includes(transport)) transports.push(transport);
    }
    return transports;
}

function safeCounter(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 0xffff_ffff) {
        throw new InvalidPasskeyServiceResponseError();
    }
    return Number(value);
}

async function reauthenticateForPasskey(
    config: PasskeyRuntimeConfig,
    session: EatRightAuthSession,
    password: string,
): Promise<EatRightAuthSession> {
    let payload: Record<string, unknown>;
    try {
        payload = await passkeyPasswordLogin(config, session.userid, password);
    } catch (error) {
        if (
            error instanceof PasskeyApiError
            && error.backendStatus === "INVALID_CREDENTIALS"
        ) {
            throw new PasskeyReauthenticationRejectedError();
        }
        if (
            error instanceof PasskeyApiError
            && (error.status === 429 || error.backendStatus === "RATE_LIMITED")
        ) {
            throw new PasskeyReauthenticationRateLimitedError(
                error.retryAfterSeconds ?? 60,
            );
        }
        if (
            error instanceof PasskeyApiError
            && error.backendStatus === "ACCOUNT_DISABLED"
        ) {
            throw new PasskeyAccountDisabledError();
        }
        throw error;
    }
    if (payload.success !== true || typeof payload.access_token !== "string") {
        throw new InvalidPasskeyServiceResponseError();
    }

    const freshSession = await verifyEatRightAccessToken(payload.access_token);
    if (!freshSession || !samePasskeyUserID(freshSession.userid, session.userid)) {
        throw new InvalidPasskeyServiceResponseError();
    }
    return freshSession;
}

function reauthenticationFailure(error: unknown): Response | null {
    if (error instanceof PasskeyReauthenticationRejectedError) {
        return errorResponse(
            401,
            "Current password is incorrect",
            "passkey_reauthentication_failed",
        );
    }
    if (error instanceof PasskeyReauthenticationRateLimitedError) {
        const seconds = error.retryAfterSeconds;
        return json(
            {
                error: "Too many password attempts. Wait a moment and try again.",
                errorCode: "rate_limited",
                retryAfterSeconds: seconds,
            },
            {
                status: 429,
                headers: {
                    ...NO_STORE,
                    "Retry-After": String(seconds),
                },
            },
        );
    }
    if (error instanceof PasskeyAccountDisabledError) {
        return errorResponse(
            403,
            "Your account is not active. Contact the Foodcourt Manager.",
            "account_disabled",
        );
    }
    return null;
}

function expiredBackendSession(
    event: RequestEvent,
    error: unknown,
): Response | null {
    if (
        !(error instanceof PasskeyApiError)
        || error.action === "reauthenticate"
        || error.backendStatus !== "UNAUTHORIZED"
    ) {
        return null;
    }
    clearEatRightSessionCookie(event.cookies, event.url);
    return errorResponse(
        401,
        "Eat Right session has expired. Please sign in again.",
        "eatright_session_expired",
    );
}

function recentAuthenticationRequired(error: unknown): Response | null {
    if (
        error instanceof PasskeyApiError
        && error.backendStatus === "REAUTH_REQUIRED"
    ) {
        return errorResponse(
            401,
            "Please enter your current password and try again.",
            "passkey_reauthentication_required",
        );
    }
    return null;
}

function registrationConflict(error: unknown): Response | null {
    if (!(error instanceof PasskeyApiError) || error.status !== 409) return null;
    if (error.backendStatus === "PASSKEY_LIMIT_REACHED") {
        return errorResponse(
            409,
            "You have reached the passkey limit. Remove one before adding another.",
            "passkey_limit_reached",
        );
    }
    if (error.backendStatus === "PASSKEY_EXISTS") {
        return errorResponse(
            409,
            "This passkey is already linked to your account.",
            "passkey_already_exists",
        );
    }
    return errorResponse(
        409,
        "Passkey setup conflicted with an existing passkey. Refresh and try again.",
        "passkey_conflict",
    );
}

function registrationContextCredentials(value: unknown): Array<{
    id: string;
    transports?: AuthenticatorTransportFuture[];
}> {
    if (!Array.isArray(value) || value.length > 32) {
        throw new InvalidPasskeyServiceResponseError();
    }
    return value.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new InvalidPasskeyServiceResponseError();
        }
        const record = item as Record<string, unknown>;
        const id = typeof record.credentialId === "string" ? record.credentialId : "";
        decodeCanonicalBase64Url(id, { maxBytes: 1023 });
        const transports = normalizeTransports(record.transports);
        return { id, ...(transports.length > 0 ? { transports } : {}) };
    });
}

function parseStoredCredential(
    payload: Record<string, unknown>,
    expectedCredentialId: string,
): { credential: WebAuthnCredential; userHandle: string } {
    requireBackendSuccess(payload);
    if (!payload.credential || typeof payload.credential !== "object" || Array.isArray(payload.credential)) {
        throw new InvalidPasskeyServiceResponseError();
    }
    const stored = payload.credential as Record<string, unknown>;
    if (stored.credentialId !== expectedCredentialId) {
        throw new InvalidPasskeyServiceResponseError();
    }
    const publicKey = decodeCanonicalBase64Url(stored.publicKey, { maxBytes: 8192 });
    const algorithm = decodeCredentialPublicKey(publicKey).get(cose.COSEKEYS.alg);
    if (algorithm !== -7 && algorithm !== -257) {
        throw new InvalidPasskeyServiceResponseError();
    }
    const counter = safeCounter(stored.counter);
    const transports = normalizeTransports(stored.transports);
    const userHandle = typeof stored.userHandle === "string" ? stored.userHandle : "";
    decodeCanonicalBase64Url(userHandle, { minBytes: 16, maxBytes: 64 });
    return {
        credential: {
            id: expectedCredentialId,
            publicKey,
            counter,
            ...(transports.length > 0 ? { transports } : {}),
        },
        userHandle,
    };
}

function normalizePasskeySummary(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const credentialId = typeof record.credentialId === "string" ? record.credentialId : "";
    const name = normalizePasskeyName(record.name);
    try {
        decodeCanonicalBase64Url(credentialId, { maxBytes: 1023 });
    } catch {
        return null;
    }
    if (!name) return null;
    const createdAt = typeof record.createdAt === "string" && record.createdAt.length <= 64
        ? record.createdAt
        : null;
    if (!createdAt) return null;
    const lastUsedAt = record.lastUsedAt === null || record.lastUsedAt === undefined
        ? null
        : typeof record.lastUsedAt === "string" && record.lastUsedAt.length <= 64
            ? record.lastUsedAt
            : undefined;
    if (lastUsedAt === undefined) return null;
    const backupEligible = typeof record.backupEligible === "boolean"
        ? record.backupEligible
        : record.deviceType === "multiDevice";
    return {
        id: credentialId,
        name,
        createdAt,
        lastUsedAt,
        backupEligible,
        backupState: record.backupState === true,
    };
}

function authenticationFailure() {
    return errorResponse(
        401,
        "Unable to sign in with this passkey",
        "passkey_authentication_failed",
    );
}

export const handleAuthenticationOptions: RequestHandler = async (event) => {
    try {
        await readOptionalPasskeyJsonBody(event.request);
    } catch (error) {
        return bodyErrorResponse(error);
    }
    const rateLimited = enforceRateLimits(event, [{
        namespace: "passkey-auth-options:ip",
        limit: 30,
        windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
    }]);
    if (rateLimited) return rateLimited;

    try {
        const config = await getPasskeyRuntimeConfig();
        const options = await generateAuthenticationOptions({
            rpID: config.rpID,
            timeout: 60_000,
            userVerification: "required",
        });
        const stored = await passkeyApiRequest(
            config,
            "store_challenge",
            { ceremony: "authentication", challenge: options.challenge },
        );
        requireBackendSuccess(stored);
        return json(options, { headers: NO_STORE });
    } catch (error) {
        const configured = configurationErrorResponse(error);
        if (configured) return configured;
        logPasskeyFailure("Unable to create passkey authentication options", error);
        return errorResponse(
            502,
            "Passkey sign-in is temporarily unavailable. Use your password and try again later.",
            "passkey_service_unavailable",
        );
    }
};

export const handleAuthenticationVerify: RequestHandler = async (event) => {
    const ipLimited = enforceRateLimits(event, [{
        namespace: "passkey-auth-verify:ip",
        limit: 20,
        windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
    }]);
    if (ipLimited) return ipLimited;

    let body: Record<string, unknown>;
    try {
        body = await readPasskeyJsonBody(event.request);
    } catch (error) {
        return bodyErrorResponse(error);
    }

    let lookup: { challenge: string; credentialId: string; userHandle: string };
    try {
        lookup = extractPasskeyLookup(body, "authentication");
    } catch {
        return authenticationFailure();
    }
    const credentialLimited = enforceRateLimits(event, [{
        namespace: "passkey-auth-verify:credential",
        identifier: lookup.credentialId,
        limit: 10,
        windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
    }]);
    if (credentialLimited) return credentialLimited;

    try {
        const config = await getPasskeyRuntimeConfig();
        const context = await passkeyApiRequest(
            config,
            "authentication_context",
            {
                challenge: lookup.challenge,
                credentialId: lookup.credentialId,
            },
        );
        const stored = parseStoredCredential(context, lookup.credentialId);
        if (!samePasskeyUserHandle(lookup.userHandle, stored.userHandle)) {
            return authenticationFailure();
        }
        const verification = await verifyAuthenticationResponse({
            response: body as unknown as AuthenticationResponseJSON,
            expectedChallenge: lookup.challenge,
            expectedOrigin: config.origins,
            expectedRPID: config.rpID,
            credential: stored.credential,
            expectedType: "webauthn.get",
            requireUserVerification: true,
        });
        if (!verification.verified || !verification.authenticationInfo.userVerified) {
            return authenticationFailure();
        }

        const completed = await passkeyApiRequest(
            config,
            "authentication_complete",
            {
                challenge: lookup.challenge,
                credentialId: lookup.credentialId,
                userHandle: stored.userHandle,
                oldCounter: stored.credential.counter,
                newCounter: verification.authenticationInfo.newCounter,
                backupEligible:
                    verification.authenticationInfo.credentialDeviceType === "multiDevice",
                backupState: verification.authenticationInfo.credentialBackedUp,
            },
        );
        requireBackendSuccess(completed);
        if (typeof completed.access_token !== "string") {
            throw new InvalidPasskeyServiceResponseError();
        }
        const session = await verifyEatRightAccessToken(completed.access_token);
        if (!session) throw new InvalidPasskeyServiceResponseError();

        setEatRightSessionCookie(event.cookies, session, event.url);
        return json(
            {
                success: true,
                name: session.name,
                userid: session.userid,
                redirectUrl: "/view/home",
            },
            { headers: NO_STORE },
        );
    } catch (error) {
        const configured = configurationErrorResponse(error);
        if (configured) return configured;
        if (error instanceof PasskeyApiError && error.status >= 500) {
            logPasskeyFailure("Passkey authentication service failed", error);
            return errorResponse(
                502,
                "Passkey sign-in is temporarily unavailable",
                "passkey_service_unavailable",
            );
        }
        logPasskeyFailure("Passkey authentication was rejected", error);
        return authenticationFailure();
    }
};

export const handleRegistrationOptions: RequestHandler = async (event) => {
    const session = resolveEatRightSessionFromEvent(event);
    if (!session.ok) return session.response;

    let body: Record<string, unknown>;
    try {
        body = await readPasskeyJsonBody(event.request, 4 * 1024);
    } catch (error) {
        return bodyErrorResponse(error);
    }
    const currentPassword = currentPasswordFrom(body);
    if (!currentPassword) {
        return errorResponse(
            400,
            "Current password is required",
            "current_password_required",
        );
    }
    const rateLimited = enforceRateLimits(event, [
        {
            namespace: "passkey-register-options:ip",
            limit: 10,
            windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
        },
        {
            namespace: "passkey-register-options:user",
            identifier: session.userid,
            limit: 5,
            windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
        },
    ]);
    if (rateLimited) return rateLimited;

    try {
        const config = await getPasskeyRuntimeConfig();
        const freshSession = await reauthenticateForPasskey(
            config,
            session,
            currentPassword,
        );
        const context = await passkeyApiRequest(
            config,
            "registration_context",
            {},
            freshSession.accessToken,
        );
        requireBackendSuccess(context);
        const userHandle = decodeCanonicalBase64Url(context.userHandle, {
            minBytes: 16,
            maxBytes: 64,
        });
        const excludeCredentials = registrationContextCredentials(context.credentials);
        const options = await generateRegistrationOptions({
            rpName: config.rpName,
            rpID: config.rpID,
            userName: session.userid,
            userDisplayName: session.name,
            userID: userHandle,
            timeout: 60_000,
            attestationType: "none",
            supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
            excludeCredentials,
            authenticatorSelection: {
                residentKey: "required",
                requireResidentKey: true,
                userVerification: "required",
            },
        });
        const stored = await passkeyApiRequest(
            config,
            "store_challenge",
            { ceremony: "registration", challenge: options.challenge },
            freshSession.accessToken,
        );
        requireBackendSuccess(stored);
        return json(options, { headers: NO_STORE });
    } catch (error) {
        const configured = configurationErrorResponse(error);
        if (configured) return configured;
        const rejected = reauthenticationFailure(error);
        if (rejected) return rejected;
        const recent = recentAuthenticationRequired(error);
        if (recent) return recent;
        const expired = expiredBackendSession(event, error);
        if (expired) return expired;
        const conflict = registrationConflict(error);
        if (conflict) return conflict;
        logPasskeyFailure("Unable to create passkey registration options", error);
        return errorResponse(
            502,
            "Unable to start passkey setup",
            "passkey_service_unavailable",
        );
    }
};

export const handleRegistrationVerify: RequestHandler = async (event) => {
    const session = resolveEatRightSessionFromEvent(event);
    if (!session.ok) return session.response;
    const rateLimited = enforceRateLimits(event, [{
        namespace: "passkey-register-verify:user",
        identifier: session.userid,
        limit: 10,
        windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
    }]);
    if (rateLimited) return rateLimited;

    let body: Record<string, unknown>;
    try {
        body = await readPasskeyJsonBody(event.request);
    } catch (error) {
        return bodyErrorResponse(error);
    }
    const name = normalizePasskeyName(body.name);
    if (!name) {
        return errorResponse(
            400,
            "Enter a name for this passkey",
            "passkey_name_invalid",
        );
    }
    let lookup: { challenge: string; credentialId: string };
    try {
        lookup = extractPasskeyLookup(body.response, "registration");
    } catch {
        return errorResponse(
            400,
            "Passkey setup could not be verified",
            "passkey_registration_failed",
        );
    }

    try {
        const config = await getPasskeyRuntimeConfig();
        const challenge = await passkeyApiRequest(
            config,
            "verify_challenge",
            { ceremony: "registration", challenge: lookup.challenge },
            session.accessToken,
        );
        requireBackendSuccess(challenge);
        const verification = await verifyRegistrationResponse({
            response: body.response as RegistrationResponseJSON,
            expectedChallenge: lookup.challenge,
            expectedOrigin: config.origins,
            expectedRPID: config.rpID,
            expectedType: "webauthn.create",
            requireUserPresence: true,
            requireUserVerification: true,
            supportedAlgorithmIDs: SUPPORTED_ALGORITHMS,
        });
        if (!verification.verified || !verification.registrationInfo.userVerified) {
            throw new TypeError("Passkey registration was not verified");
        }

        const info = verification.registrationInfo;
        if (info.credential.id !== lookup.credentialId) {
            throw new TypeError("Passkey credential ID mismatch");
        }
        const algorithm = decodeCredentialPublicKey(info.credential.publicKey).get(
            cose.COSEKEYS.alg,
        );
        if (algorithm !== -7 && algorithm !== -257) {
            throw new TypeError("Unsupported passkey algorithm");
        }
        const backupEligible = info.credentialDeviceType === "multiDevice";
        const transports = normalizeTransports(info.credential.transports);
        const completed = await passkeyApiRequest(
            config,
            "registration_complete",
            {
                challenge: lookup.challenge,
                credentialId: info.credential.id,
                publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
                algorithm,
                counter: info.credential.counter,
                transports,
                deviceType: info.credentialDeviceType,
                backupEligible,
                backupState: info.credentialBackedUp,
                discoverable: true,
                aaguid: info.aaguid,
                name,
            },
            session.accessToken,
        );
        requireBackendSuccess(completed);
        const passkey = normalizePasskeySummary(completed.passkey);
        if (!passkey) throw new InvalidPasskeyServiceResponseError();
        return json({ success: true, passkey }, { headers: NO_STORE });
    } catch (error) {
        const configured = configurationErrorResponse(error);
        if (configured) return configured;
        const expired = expiredBackendSession(event, error);
        if (expired) return expired;
        const conflict = registrationConflict(error);
        if (conflict) return conflict;
        if (
            error instanceof InvalidPasskeyServiceResponseError ||
            (error instanceof PasskeyApiError && error.status >= 500)
        ) {
            logPasskeyFailure("Passkey registration service failed", error);
            return errorResponse(
                502,
                "Passkey setup is temporarily unavailable",
                "passkey_service_unavailable",
            );
        }
        logPasskeyFailure("Passkey registration was rejected", error);
        return errorResponse(
            error instanceof PasskeyApiError && error.status === 409 ? 409 : 400,
            "Passkey setup could not be completed",
            "passkey_registration_failed",
        );
    }
};

export const handleListPasskeys: RequestHandler = async (event) => {
    const session = resolveEatRightSessionFromEvent(event);
    if (!session.ok) return session.response;
    const rateLimited = enforceRateLimits(event, [{
        namespace: "passkey-list:user",
        identifier: session.userid,
        limit: 60,
        windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
    }]);
    if (rateLimited) return rateLimited;

    try {
        const config = await getPasskeyRuntimeConfig();
        const payload = await passkeyApiRequest(
            config,
            "list",
            {},
            session.accessToken,
        );
        requireBackendSuccess(payload);
        if (!Array.isArray(payload.passkeys) || payload.passkeys.length > 32) {
            throw new InvalidPasskeyServiceResponseError();
        }
        const passkeys = payload.passkeys.map(normalizePasskeySummary);
        if (passkeys.some((passkey) => !passkey)) {
            throw new InvalidPasskeyServiceResponseError();
        }
        return json({ success: true, passkeys }, { headers: NO_STORE });
    } catch (error) {
        const configured = configurationErrorResponse(error);
        if (configured) return configured;
        const expired = expiredBackendSession(event, error);
        if (expired) return expired;
        logPasskeyFailure("Unable to list passkeys", error);
        return errorResponse(
            502,
            "Unable to load passkeys",
            "passkey_service_unavailable",
        );
    }
};

export const handleRevokePasskey: RequestHandler = async (event) => {
    const session = resolveEatRightSessionFromEvent(event);
    if (!session.ok) return session.response;

    let body: Record<string, unknown>;
    try {
        body = await readPasskeyJsonBody(event.request, 8 * 1024);
    } catch (error) {
        return bodyErrorResponse(error);
    }
    const currentPassword = currentPasswordFrom(body);
    const credentialId = typeof body.credentialId === "string" ? body.credentialId : "";
    if (!currentPassword) {
        return errorResponse(
            400,
            "Current password is required",
            "current_password_required",
        );
    }
    try {
        decodeCanonicalBase64Url(credentialId, { maxBytes: 1023 });
    } catch {
        return errorResponse(400, "Invalid passkey", "passkey_credential_invalid");
    }
    const rateLimited = enforceRateLimits(event, [
        {
            namespace: "passkey-revoke:ip",
            limit: 10,
            windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
        },
        {
            namespace: "passkey-revoke:user",
            identifier: session.userid,
            limit: 5,
            windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
        },
    ]);
    if (rateLimited) return rateLimited;

    try {
        const config = await getPasskeyRuntimeConfig();
        const freshSession = await reauthenticateForPasskey(
            config,
            session,
            currentPassword,
        );
        const payload = await passkeyApiRequest(
            config,
            "revoke",
            { credentialId },
            freshSession.accessToken,
        );
        requireBackendSuccess(payload);
        return json({ success: true }, { headers: NO_STORE });
    } catch (error) {
        const configured = configurationErrorResponse(error);
        if (configured) return configured;
        const rejected = reauthenticationFailure(error);
        if (rejected) return rejected;
        const recent = recentAuthenticationRequired(error);
        if (recent) return recent;
        const expired = expiredBackendSession(event, error);
        if (expired) return expired;
        logPasskeyFailure("Unable to revoke passkey", error);
        return errorResponse(
            error instanceof PasskeyApiError
                && error.action === "revoke"
                && error.status === 404
                ? 404
                : 502,
            "Unable to remove passkey",
            "passkey_revoke_failed",
        );
    }
};
