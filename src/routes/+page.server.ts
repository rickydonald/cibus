import { redirect } from "@sveltejs/kit";
import { getEatRightSession } from "$lib/server/eatright";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ cookies }) => {
    const session = getEatRightSession(cookies);
    redirect(307, session ? "/view/home" : "/login");
};
