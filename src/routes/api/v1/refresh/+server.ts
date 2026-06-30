import { json } from "@sveltejs/kit";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "$lib/server/jwt";

export async function POST({ request }) {
    let body: { refreshToken?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.refreshToken) {
        return json({ error: "refreshToken is required" }, { status: 400 });
    }

    const payload = verifyRefreshToken(body.refreshToken);
    if (!payload) {
        return json({ error: "Invalid or expired refresh token", errorCode: "refresh_token_invalid" }, { status: 401 });
    }

    return json({
        accessToken: signAccessToken(payload.session),
        refreshToken: signRefreshToken(payload.session),
    });
}
