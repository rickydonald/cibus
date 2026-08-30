import { redirect } from "@sveltejs/kit";
import { eatRight } from "$lib/server/eatright/index";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ cookies, url }) => {
    if (!eatRight.isConnected(cookies)) {
        const loginUrl = new URL("/login", url.origin);
        loginUrl.searchParams.set("redirect", url.pathname + url.search);
        redirect(307, loginUrl.toString());
    }

    return {};
};
