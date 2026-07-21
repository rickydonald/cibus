import { json, type Cookies, type RequestEvent } from "@sveltejs/kit";
import {
    EatRightAuthConfigurationError,
    verifyEatRightJwt,
} from "./eatright-jwt";

const SESSION_COOKIE_NAME = "RioX5EatRightSession";

export type EatRightSession = {
    access_token: string;
    success: boolean;
    token_type: string;
    expires_in: number;
};

export type EatRightIdentity = {
    name: string;
    userid: string;
};

export type EatRightAuthSession = EatRightIdentity & {
    accessToken: string;
    expiresAt: number;
};

export type EatRightAuthErrorCode =
    | "token_invalid"
    | "eatright_session_expired"
    | "eatright_auth_unavailable";

export type EatRightAuthState = {
    session: EatRightAuthSession | null;
    errorCode: EatRightAuthErrorCode | null;
};

export type EatRightSessionResolution =
    | ({ ok: true; reauthenticated: false } & EatRightAuthSession)
    | { ok: false; response: ReturnType<typeof json> };

export async function verifyEatRightAccessToken(
    accessToken: string,
): Promise<EatRightAuthSession | null> {
    const identity = await verifyEatRightJwt(accessToken);
    return identity ? { accessToken, ...identity } : null;
}

function sessionCookieOptions(url: URL) {
    return {
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        // SvelteKit defaults cookies to Secure for every hostname except localhost.
        // The campus deployment is also accessed directly over HTTP by private IP,
        // where browsers discard Secure cookies.
        secure: false,
    };
}

export function setEatRightSessionCookie(
    cookies: Cookies,
    session: EatRightAuthSession,
    url: URL,
) {
    const tokenLifetime = session.expiresAt - Math.floor(Date.now() / 1000);
    cookies.set(SESSION_COOKIE_NAME, session.accessToken, {
        ...sessionCookieOptions(url),
        maxAge: Math.max(0, tokenLifetime),
    });
}

export function clearEatRightSessionCookie(cookies: Cookies, url: URL) {
    cookies.delete(SESSION_COOKIE_NAME, sessionCookieOptions(url));
}

export async function authenticateEatRightRequest(
    event: RequestEvent,
): Promise<EatRightAuthState> {
    const authHeader = event.request.headers.get("authorization");
    const bearerToken = authHeader?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    const hasAuthorizationHeader = authHeader !== null;
    const cookieToken = event.cookies.get(SESSION_COOKIE_NAME);
    const accessToken = hasAuthorizationHeader ? bearerToken : cookieToken;

    if (!accessToken) {
        return {
            session: null,
            errorCode: hasAuthorizationHeader ? "token_invalid" : null,
        };
    }

    try {
        const session = await verifyEatRightAccessToken(accessToken);
        if (session) return { session, errorCode: null };

        if (!hasAuthorizationHeader) clearEatRightSessionCookie(event.cookies, event.url);
        return {
            session: null,
            errorCode: hasAuthorizationHeader ? "token_invalid" : "eatright_session_expired",
        };
    } catch (error) {
        if (error instanceof EatRightAuthConfigurationError) {
            console.error(error.message);
            return { session: null, errorCode: "eatright_auth_unavailable" };
        }
        throw error;
    }
}

export function resolveEatRightSessionFromEvent(
    event: RequestEvent,
): EatRightSessionResolution {
    if (event.locals.eatRightAuth) {
        return {
            ok: true,
            reauthenticated: false,
            ...event.locals.eatRightAuth,
        };
    }

    if (event.locals.eatRightAuthError === "token_invalid") {
        return {
            ok: false,
            response: json(
                { error: "Invalid or expired access token", errorCode: "token_invalid" },
                { status: 401 },
            ),
        };
    }

    if (event.locals.eatRightAuthError === "eatright_auth_unavailable") {
        return {
            ok: false,
            response: json(
                {
                    error: "Authentication service is unavailable",
                    errorCode: "eatright_auth_unavailable",
                },
                { status: 503 },
            ),
        };
    }

    const expired = event.locals.eatRightAuthError === "eatright_session_expired";
    return {
        ok: false,
        response: json(
            {
                error: expired
                    ? "EatRight session has expired. Please sign in again."
                    : "EatRight session is missing. Please sign in.",
                errorCode: expired
                    ? "eatright_session_expired"
                    : "eatright_session_missing",
            },
            { status: 401 },
        ),
    };
}
