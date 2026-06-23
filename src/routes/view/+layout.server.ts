import { redirect } from "@sveltejs/kit";
import { getEatRightSession } from "$lib/server/eatright";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ cookies, url }) => {
    const session = getEatRightSession(cookies);

    if (!session) {
        const loginUrl = new URL("/login", url.origin);
        loginUrl.searchParams.set("redirect", url.pathname + url.search);
        redirect(307, loginUrl.toString());
    }

    return {};
};
