import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals, url }) => {
    if (!locals.eatRightAuth) {
        const loginUrl = new URL("/login", url.origin);
        loginUrl.searchParams.set("redirect", url.pathname + url.search);
        redirect(307, loginUrl.toString());
    }

    return { userid: locals.eatRightAuth.userid };
};
