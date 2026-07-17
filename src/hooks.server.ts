import type { Handle } from "@sveltejs/kit";
import { authenticateEatRightRequest } from "$lib/server/eatright";

export const handle: Handle = async ({ event, resolve }) => {
    const auth = await authenticateEatRightRequest(event);
    event.locals.eatRightAuth = auth.session;
    event.locals.eatRightAuthError = auth.errorCode;

    const response = await resolve(event);
    if (event.url.pathname.startsWith("/api/")) {
        response.headers.set("Cache-Control", "no-store");
    }
    return response;
};
