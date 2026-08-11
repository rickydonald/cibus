import { json, type RequestHandler } from "@sveltejs/kit";
import { clearEatRightSessionCookie } from "$lib/server/eatright";
import { foodcourtApiRequest } from "$lib/server/foodcourt-api";

export const POST: RequestHandler = async (event) => {
    const accessToken = event.locals.eatRightAuth?.accessToken;
    try {
        if (accessToken) {
            await foodcourtApiRequest("/ajax/api/logout.jsp", {
                method: "POST",
                accessToken,
            });
        }
        return json({ success: true });
    } catch (error) {
        console.error("Unable to revoke Foodcourt access token", error);
        return json(
            { success: false, error: "Signed out locally, but server token revocation failed" },
            { status: 502 },
        );
    } finally {
        clearEatRightSessionCookie(event.cookies, event.url);
    }
};
