import { redirect } from "@sveltejs/kit";
import { eatRight } from "$lib/server/eatright";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ cookies, url }) => {
    if (eatRight.isConnected(cookies)) {
        const redirectTo = url.searchParams.get("redirect") || "/view/home";
        redirect(307, redirectTo);
    }
};
