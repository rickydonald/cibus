import { json, type RequestHandler } from "@sveltejs/kit";
import { setEatRightSessionCookie, type EatRightSession } from "$lib/server/eatright";
import { foodcourtApiRequest, FoodcourtApiError } from "$lib/server/foodcourt-api";
import { signAccessToken, signRefreshToken } from "$lib/server/jwt";

export const POST: RequestHandler = async ({ request, cookies }) => {
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

    try {
        const session = await foodcourtApiRequest<EatRightSession>("/ajax/apiLogin.jsp", {
            method: "POST",
            body: new URLSearchParams({ erpuserId: userId, erpuserPwd: password }),
        });

        if (!session.success || !session.access_token) {
            return json({ error: "Invalid user ID or password" }, { status: 401 });
        }

        setEatRightSessionCookie(cookies, session);
        return json({
            success: true,
            accessToken: signAccessToken(session),
            refreshToken: signRefreshToken(session),
            redirectUrl: "/view/home",
        });
    } catch (error) {
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
