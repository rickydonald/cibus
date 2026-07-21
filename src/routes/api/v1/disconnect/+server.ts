import { json } from "@sveltejs/kit";
import { clearEatRightSessionCookie } from "$lib/server/eatright";

export function POST({ cookies, url }) {
    clearEatRightSessionCookie(cookies, url);
    return json({ success: true });
}
