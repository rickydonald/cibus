import { json, type RequestHandler } from "@sveltejs/kit";
import {
    setEatRightSessionCookie,
    verifyEatRightAccessToken,
    type EatRightSession,
} from "$lib/server/eatright";
import { EatRightAuthConfigurationError } from "$lib/server/eatright-jwt";
import { foodcourtApiRequest, FoodcourtApiError } from "$lib/server/foodcourt-api";
import { enforceRateLimits } from "$lib/server/rate-limit";

export const POST: RequestHandler = async (event) => {
    const { request, cookies } = event;
    let body: { userId?: string; password?: string };
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const userId = body.userId?.trim();
    const password = body.password;
    if (!userId || !password) {
        return json({ error: "userId and password are required" }, { status: 400 });
    }

    const rateLimited = enforceRateLimits(event, [
        { namespace: "login:ip", limit: 30, windowMs: 15 * 60 * 1000 },
        {
            namespace: "login:userid",
            identifier: userId.toUpperCase(),
            limit: 10,
            windowMs: 15 * 60 * 1000,
        },
    ]);
    if (rateLimited) return rateLimited;

    try {
        const session = await foodcourtApiRequest<EatRightSession>("/ajax/api/userLogin.jsp", {
            method: "POST",
            body: new URLSearchParams({ erpuserId: userId, erpuserPwd: password }),
        });

        if (!session.success || !session.access_token) {
            return json({ error: "Invalid user ID or password" }, { status: 401 });
        }

        const auth = await verifyEatRightAccessToken(session.access_token);
        if (!auth) {
            return json(
                { error: "Foodcourt returned an invalid access token" },
                { status: 502 },
            );
        }

        setEatRightSessionCookie(cookies, auth);
        return json({
            success: true,
            name: auth.name,
            userid: auth.userid,
            redirectUrl: "/view/home",
        });
    } catch (error) {
        if (error instanceof EatRightAuthConfigurationError) {
            console.error(error.message);
            return json(
                { error: "Authentication service is not configured" },
                { status: 503 },
            );
        }
        if (error instanceof FoodcourtApiError) {
            return json(
                { error: error.message, errorCode: "foodcourt_login_failed" },
                { status: error.status },
            );
        }
        console.error(error);
        return json({ error: "Unable to reach the Foodcourt API" }, { status: 502 });
    }
};
