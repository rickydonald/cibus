import { redirect } from "@sveltejs/kit";
import { getSafeRedirectPath } from "$lib/auth-redirect";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
    if (locals.eatRightAuth) {
        const redirectTo = getSafeRedirectPath(url.searchParams.get("redirect"));
        redirect(307, redirectTo);
    }
};
