import { redirect } from "@sveltejs/kit";
import { getEatRightSession } from "$lib/server/eatright";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ cookies, url }) => {
    const session = getEatRightSession(cookies);
    if (session) {
        const redirectTo = url.searchParams.get("redirect") || "/view/home";
        redirect(307, redirectTo);
    }
};
