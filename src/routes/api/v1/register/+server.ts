import { json } from "@sveltejs/kit";
import {
    foodcourtRegistrationRequest,
    REGISTRATION_SESSION_COOKIE,
    RegistrationApiError,
    registrationStatusError,
    validateRegistrationInput,
} from "$lib/server/registration";
import { enforceRateLimits } from "$lib/server/rate-limit";

const noStore = { "Cache-Control": "no-store" };

export async function POST(event) {
    const { request, cookies } = event;
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400, headers: noStore });
    }

    const input = validateRegistrationInput({
        userType: body.userType,
        identifier: body.identifier,
        mobile: body.mobile,
    });
    if (!input.ok) return json({ error: input.message }, { status: 400, headers: noStore });

    const rateLimited = enforceRateLimits(event, [
        { namespace: "register:ip", limit: 10, windowMs: 15 * 60 * 1000 },
        {
            namespace: "register:mobile",
            identifier: input.mobile,
            limit: 3,
            windowMs: 10 * 60 * 1000,
        },
    ]);
    if (rateLimited) return rateLimited;

    try {
        const isGuest = input.userType === "guest";
        const form = isGuest
            ? new URLSearchParams({ action: "checkMobile", name: input.identifier, mobile: input.mobile })
            : new URLSearchParams({
                userid: input.identifier,
                mobile: input.mobile,
                usertype: input.userType === "staff" ? "F" : "S",
            });
        const backendSession = isGuest ? cookies.get(REGISTRATION_SESSION_COOKIE) : undefined;
        const { payload, sessionId } = await foodcourtRegistrationRequest(
            isGuest ? "/ajax/GuestController.jsp" : "/ajax/registerUser.jsp",
            form,
            backendSession,
        );

        if (payload.status !== "OTP_SENT") {
            const failure = registrationStatusError(payload.status);
            return json({ error: failure.message }, { status: failure.status, headers: noStore });
        }

        if (isGuest) {
            const activeSession = sessionId ?? backendSession;
            if (!activeSession) {
                return json({ error: "Guest verification session was not created" }, { status: 502, headers: noStore });
            }
            cookies.set(REGISTRATION_SESSION_COOKIE, activeSession, {
                path: "/api/v1/register",
                httpOnly: true,
                sameSite: "strict",
                maxAge: 10 * 60,
            });
        } else {
            cookies.delete(REGISTRATION_SESSION_COOKIE, { path: "/api/v1/register" });
        }

        return json({ status: "OTP_SENT", otpLength: isGuest ? 4 : 6 }, { headers: noStore });
    } catch (error) {
        if (error instanceof RegistrationApiError) {
            const failure = registrationStatusError(error.payload.status);
            return json({ error: failure.message }, {
                status: error.status >= 400 && error.status < 500 ? error.status : failure.status,
                headers: noStore,
            });
        }
        return json({ error: "Unable to reach the registration service" }, { status: 502, headers: noStore });
    }
}
