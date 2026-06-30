import { json, type RequestEvent } from "@sveltejs/kit";
import type { Cookies } from "@sveltejs/kit";
import * as cheerio from "cheerio";
import { verifyAccessToken } from "./jwt";

const BASE = "https://eatright.loyolacollege.edu";
const LOGIN_JSP = `${BASE}/ajax/loggedin.jsp`;
const HOME_URL = `${BASE}/`;
const PAGE_CONTROLLER_URL = `${BASE}/pagecontroller.jsp`;
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const SESSION_COOKIE_NAME = "RioX5EatRightSession";

export type EatRightSession = {
    creds: {
        username: string;
        password: string;
    };
    cookies: string;
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
    | { ok: true; cookieHeader: string; reauthenticated: boolean; username: string }
    | { ok: false; response: ReturnType<typeof json> };

interface PageMeta {
    csrfToken: string;
    captcha: string;
    setCookies: string[];
}

function getSetCookies(res: Response): string[] {
    if (typeof (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
        return (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
    }

    const raw = res.headers.get("set-cookie");
    if (!raw) return [];

    return raw.split(/,(?=\s*[A-Za-z0-9_\-]+=)/).map((value) => value.trim());
}

function toCookieHeader(setCookies: string[]): string {
    return setCookies.map((cookie) => cookie.split(";")[0].trim()).join("; ");
}

function mergeCookies(...groups: string[][]): string[] {
    const map = new Map<string, string>();

    for (const group of groups) {
        for (const raw of group) {
            const name = raw.split("=")[0].trim();
            map.set(name, raw);
        }
    }

    return [...map.values()];
}

async function scrapePageMeta(): Promise<PageMeta> {
    const res = await fetch(HOME_URL, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        redirect: "follow",
    });

    if (!res.ok) {
        throw new Error(`Home page returned HTTP ${res.status}`);
    }

    const html = await res.text();
    const setCookies = getSetCookies(res);

    const csrfMatch =
        html.match(/name=["']csrf_token["'][^>]*value=["']([^"']+)["']/) ??
        html.match(/value=["']([^"']+)["'][^>]*name=["']csrf_token["']/);
    if (!csrfMatch) {
        throw new Error("csrf_token not found on login page");
    }

    const captchaMatch = html.match(
        /class=["'][^"']*badge[^"']*["'][^>]*>\s*(\d{3,6})\s*<\/span>/,
    );
    if (!captchaMatch) {
        throw new Error("Captcha value not found on login page");
    }

    return {
        csrfToken: csrfMatch[1],
        captcha: captchaMatch[1].trim(),
        setCookies,
    };
}

function isAuthenticatedPage(html: string): boolean {
    const $ = cheerio.load(html);
    const user = $("#navmenu li:first-child a").text().trim();
    const hasOutlets = $(".outlet-card").length > 0;

    return Boolean(user || hasOutlets);
}

export async function isEatRightSessionValid(cookieHeader: string): Promise<boolean> {
    if (!cookieHeader) return false;

    try {
        const response = await fetch(PAGE_CONTROLLER_URL, {
            headers: {
                "User-Agent": UA,
                Cookie: cookieHeader,
            },
            redirect: "manual",
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location") ?? "";
            if (/login|loggedin|index/i.test(location)) {
                return false;
            }
        }

        if (!response.ok) {
            return false;
        }

        const html = await response.text();
        return isAuthenticatedPage(html);
    } catch (error) {
        console.error("[eatright] failed to validate session:", error);
        return false;
    }
}

export async function performEatRightLogin(input: {
    userId: string;
    password: string;
}): Promise<{ success: true; cookieHeader: string } | { success: false; error: string }> {
    let meta: PageMeta;

    try {
        meta = await scrapePageMeta();
    } catch (error) {
        console.error("[eatright] scrape error:", error);
        return {
            success: false,
            error: "Failed to load login page",
        };
    }

    const formBody = new URLSearchParams({
        erpuserId: input.userId,
        erpuserPwd: input.password,
        captcha: meta.captcha,
        csrf_token: meta.csrfToken,
    });

    let loginRes: Response;
    try {
        loginRes = await fetch(LOGIN_JSP, {
            method: "POST",
            redirect: "manual",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Referer: HOME_URL,
                Origin: BASE,
                "User-Agent": UA,
                Accept: "text/html,application/xhtml+xml,*/*",
                Cookie: toCookieHeader(meta.setCookies),
            },
            body: formBody.toString(),
        });
    } catch (error) {
        console.error("[eatright] login POST error:", error);
        return {
            success: false,
            error: "Network error reaching login endpoint",
        };
    }

    const loginCookies = getSetCookies(loginRes);
    let landingCookies: string[] = [];
    const redirectLocation = loginRes.headers.get("location") ?? "";
    const isRedirect = loginRes.status >= 300 && loginRes.status < 400;

    if (isRedirect && redirectLocation) {
        try {
            const allSoFar = mergeCookies(meta.setCookies, loginCookies);
            const landingRes = await fetch(
                redirectLocation.startsWith("http")
                    ? redirectLocation
                    : `${BASE}${redirectLocation}`,
                {
                    redirect: "manual",
                    headers: {
                        "User-Agent": UA,
                        Cookie: toCookieHeader(allSoFar),
                    },
                },
            );
            landingCookies = getSetCookies(landingRes);
        } catch {
            // Landing page cookies are optional.
        }
    }

    let responseBody: unknown = "";
    if (!isRedirect) {
        const contentType = loginRes.headers.get("content-type") ?? "";
        responseBody = contentType.includes("application/json")
            ? await loginRes.json()
            : await loginRes.text();
    }

    const success =
        isRedirect ||
        (typeof responseBody === "object" &&
            responseBody !== null &&
            (responseBody as Record<string, unknown>).status === "SUCCESS") ||
        (typeof responseBody === "string" &&
            responseBody.toLowerCase().includes("pagecontroller"));

    if (!success) {
        return {
            success: false,
            error: "Login failed – invalid credentials or captcha mismatch",
        };
    }

    const allCookies = mergeCookies(meta.setCookies, loginCookies, landingCookies);

    return {
        success: true,
        cookieHeader: toCookieHeader(allCookies),
    };
}

export function setEatRightSessionCookie(cookies: Cookies, session: EatRightSession) {
    const encoded = btoa(JSON.stringify(session));

    cookies.set(SESSION_COOKIE_NAME, encoded, {
        path: "/",
        httpOnly: true,
        secure: import.meta.env.PROD ? true : false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
    });
}

export function clearEatRightSessionCookie(cookies: Cookies) {
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
}

export function getEatRightSession(cookies: Cookies): EatRightSession | null {
    const raw = cookies.get(SESSION_COOKIE_NAME);
    if (!raw) return null;

    try {
        const decoded = atob(raw);
        const session = JSON.parse(decoded) as Partial<EatRightSession>;

        if (!session.cookies || !session.creds?.username || !session.creds?.password) {
            return null;
        }

        return {
            creds: {
                username: session.creds.username,
                password: session.creds.password,
            },
            cookies: session.cookies,
        };
    } catch (error) {
        console.error("[eatright] failed to decode session cookie:", error);
        return null;
    }
}

export function getEatRightCookieHeader(cookies: Cookies): string | null {
    return getEatRightSession(cookies)?.cookies ?? null;
}

export function jsonEatRightSessionError(error: EatRightSessionError) {
    return json(
        {
            error: error.message,
            errorCode: error.errorCode,
        },
        { status: error.status },
    );
}

export async function ensureValidEatRightSession(input: {
    cookies?: Cookies;
    session?: EatRightSession;
}): Promise<{ cookieHeader: string; reauthenticated: boolean; username: string }> {
    const session = input.session ?? (input.cookies ? getEatRightSession(input.cookies) : null);
    if (!session) {
        throw new EatRightSessionError(
            "eatright_session_missing",
            "EatRight account is not connected",
        );
    }

    if (await isEatRightSessionValid(session.cookies)) {
        return {
            cookieHeader: session.cookies,
            reauthenticated: false,
            username: session.creds.username,
        };
    }

    const loginResult = await performEatRightLogin({
        userId: session.creds.username,
        password: session.creds.password,
    });

    if (!loginResult.success) {
        if (input.cookies) clearEatRightSessionCookie(input.cookies);
        throw new EatRightSessionError(
            "eatright_session_expired",
            "EatRight session expired. Please reconnect your account.",
        );
    }

    if (input.cookies) {
        setEatRightSessionCookie(input.cookies, {
            creds: session.creds,
            cookies: loginResult.cookieHeader,
        });
    }

    return {
        cookieHeader: loginResult.cookieHeader,
        reauthenticated: true,
        username: session.creds.username,
    };
}

export async function resolveEatRightSession(input: {
    cookies?: Cookies;
    session?: EatRightSession;
}): Promise<EatRightSessionResolution> {
    try {
        const result = await ensureValidEatRightSession(input);
        return { ok: true, ...result };
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
    const authHeader = event.request.headers.get("authorization") ?? event.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (token) {
        const payload = verifyAccessToken(token);
        if (payload) {
            return resolveEatRightSession({ session: payload.session });
        }
        return {
            ok: false,
            response: json(
                { error: "Invalid or expired access token", errorCode: "token_invalid" },
                { status: 401 },
            ),
        };
    }

    return resolveEatRightSession({ cookies: event.cookies });
}

export async function scrapeEatRightCaptcha(): Promise<string> {
    const { captcha } = await scrapePageMeta();
    return captcha;
}
