import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
    redirect(307, locals.eatRightAuth ? "/view/home" : "/login");
};
