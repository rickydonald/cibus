import { json, type Cookies, type RequestEvent } from "@sveltejs/kit";
import { verifyAccessToken } from "./jwt";

const SESSION_COOKIE_NAME = "RioX5EatRightSession";
const EXPIRY_SKEW_SECONDS = 30;

export type EatRightSession = {
    access_token: string;
    success: boolean;
    token_type: string;
    expires_in: number;
};

type OfficialTokenClaims = {
    sub?: string;
    exp?: number;
};

export class EatRightSessionError extends Error {
    constructor(
        public errorCode: string,
        message: string,
        public status = 401,
    ) {
        super(message);
        this.name = "EatRightSessionError";
    }
}

export type EatRightSessionResolution =
    | { ok: true; accessToken: string; reauthenticated: false; username: string }
    | { ok: false; response: ReturnType<typeof json> };

function decodeTokenClaims(token: string): OfficialTokenClaims | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        return JSON.parse(atob(padded)) as OfficialTokenClaims;
    } catch {
        return null;
    }
}

function isSessionValid(session: EatRightSession): boolean {
    if (!session.success || !session.access_token) return false;
    const claims = decodeTokenClaims(session.access_token);
    return !!claims?.sub && typeof claims.exp === "number"
        && claims.exp > Math.floor(Date.now() / 1000) + EXPIRY_SKEW_SECONDS;
}

export function setEatRightSessionCookie(cookies: Cookies, session: EatRightSession) {
    cookies.set(SESSION_COOKIE_NAME, btoa(JSON.stringify(session)), {
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: session.expires_in,
    });
}

export function getEatRightSession(cookies: Cookies): EatRightSession | null {
    const encoded = cookies.get(SESSION_COOKIE_NAME);
    if (!encoded) return null;

    try {
        const session = JSON.parse(atob(encoded)) as EatRightSession;
        return isSessionValid(session) ? session : null;
    } catch {
        return null;
    }
}

export function clearEatRightSessionCookie(cookies: Cookies) {
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
}

export function jsonEatRightSessionError(error: EatRightSessionError) {
    return json(
        { error: error.message, errorCode: error.errorCode },
        { status: error.status },
    );
}

export async function ensureValidEatRightSession(input: {
    cookies?: Cookies;
    session?: EatRightSession;
}): Promise<{ accessToken: string; reauthenticated: false; username: string }> {
    const session = input.session ?? (input.cookies ? getEatRightSession(input.cookies) : null);
    if (!session || !isSessionValid(session)) {
        if (input.cookies) clearEatRightSessionCookie(input.cookies);
        throw new EatRightSessionError(
            "eatright_session_expired",
            "EatRight session is missing or expired. Please sign in again.",
        );
    }

    const claims = decodeTokenClaims(session.access_token);
    return {
        accessToken: session.access_token,
        reauthenticated: false,
        username: claims?.sub ?? "",
    };
}

export async function resolveEatRightSession(input: {
    cookies?: Cookies;
    session?: EatRightSession;
}): Promise<EatRightSessionResolution> {
    try {
        return { ok: true, ...(await ensureValidEatRightSession(input)) };
    } catch (error) {
        if (error instanceof EatRightSessionError) {
            return { ok: false, response: jsonEatRightSessionError(error) };
        }
        throw error;
    }
}

export async function resolveEatRightSessionFromEvent(
    event: RequestEvent,
): Promise<EatRightSessionResolution> {
    const authHeader = event.request.headers.get("authorization");
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

    if (token) {
        const payload = verifyAccessToken(token);
        if (!payload) {
            return {
                ok: false,
                response: json(
                    { error: "Invalid or expired access token", errorCode: "token_invalid" },
                    { status: 401 },
                ),
            };
        }
        return resolveEatRightSession({ session: payload.session });
    }

    return resolveEatRightSession({ cookies: event.cookies });
}
