import { json, type RequestHandler } from "@sveltejs/kit";
import {
    performEatRightLogin,
    scrapeEatRightCaptcha,
    setEatRightSessionCookie,
} from "$lib/server/eatright";

export const POST: RequestHandler = async ({ request, cookies }) => {
    let body: { userId?: string; password?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, password } = body;
    if (!userId || !password) {
        return json({ error: "userId and password are required" }, { status: 400 });
    }

    const loginResult = await performEatRightLogin({ userId, password });
    if (!loginResult.success) {
        return json(
            {
                error: loginResult.error,
            }, 
            { status: 401 },
        );
    }

    setEatRightSessionCookie(cookies, {
        creds: {
            username: userId,
            password,
        },
        cookies: loginResult.cookieHeader,
    });

    return json({
        success: true,
        redirectUrl: "/view/home",
    });
};

export const GET: RequestHandler = async () => {
    try {
        const captcha = await scrapeEatRightCaptcha();
        return json({ captcha });
    } catch (error) {
        return json({ error: String(error) }, { status: 502 });
    }
};
