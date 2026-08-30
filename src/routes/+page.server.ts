import { redirect } from "@sveltejs/kit";
import { eatRight } from "$lib/server/eatright/index";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ cookies }) => {
    redirect(307, eatRight.isConnected(cookies) ? "/view/home" : "/login");
};
