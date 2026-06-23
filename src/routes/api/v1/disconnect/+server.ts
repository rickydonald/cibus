import { json } from "@sveltejs/kit";
import { clearEatRightSessionCookie } from "$lib/server/eatright";

export function POST({ cookies }) {
    clearEatRightSessionCookie(cookies);
    return json({ success: true });
}
