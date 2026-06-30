import jwt from "jsonwebtoken";
import type { EatRightSession } from "./eatright";
import { env } from "$env/dynamic/private";

const SECRET = (env.JWT_SECRET ?? "dev-jwt-secret-change-in-prod").trim();
const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "30d";

export type JwtAccessPayload = {
    type: "access";
    session: EatRightSession;
};

export type JwtRefreshPayload = {
    type: "refresh";
    username: string;
    session: EatRightSession;
};

export function signAccessToken(session: EatRightSession): string {
    return jwt.sign({ type: "access", session } satisfies JwtAccessPayload, SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(session: EatRightSession): string {
    return jwt.sign(
        { type: "refresh", username: session.creds.username, session } satisfies JwtRefreshPayload,
        SECRET,
        { expiresIn: REFRESH_EXPIRY },
    );
}

export function verifyAccessToken(token: string): JwtAccessPayload | null {
    try {
        const decoded = jwt.verify(token, SECRET) as JwtAccessPayload;
        if (decoded.type !== "access" || !decoded.session?.creds?.username || !decoded.session?.cookies) {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

export function verifyRefreshToken(token: string): JwtRefreshPayload | null {
    try {
        const decoded = jwt.verify(token, SECRET) as JwtRefreshPayload;
        if (decoded.type !== "refresh" || !decoded.username || !decoded.session?.creds?.username) return null;
        return decoded;
    } catch {
        return null;
    }
}
