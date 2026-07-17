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

    const otp = String(body.otp ?? "").replace(/\D/g, "");
    const expectedLength = input.userType === "guest" ? 4 : 6;
    if (otp.length !== expectedLength) {
        return json({ error: `Enter the ${expectedLength}-digit OTP` }, { status: 400, headers: noStore });
    }

    const rateLimited = enforceRateLimits(event, [
        { namespace: "register-verify:ip", limit: 30, windowMs: 10 * 60 * 1000 },
        {
            namespace: "register-verify:mobile",
            identifier: input.mobile,
            limit: 8,
            windowMs: 10 * 60 * 1000,
        },
    ]);
    if (rateLimited) return rateLimited;

    try {
        const isGuest = input.userType === "guest";
        const backendSession = isGuest ? cookies.get(REGISTRATION_SESSION_COOKIE) : undefined;
        if (isGuest && !backendSession) {
            return json({ error: "The verification session expired. Request a new code." }, { status: 410, headers: noStore });
        }

        const form = isGuest
            ? new URLSearchParams({
                action: "verifyOTP",
                name: input.identifier,
                mobile: input.mobile,
                otp,
            })
            : new URLSearchParams({ userid: input.identifier, mobile: input.mobile, otp });
        const { payload } = await foodcourtRegistrationRequest(
            isGuest ? "/ajax/GuestController.jsp" : "/ajax/verifyOtp.jsp",
            form,
            backendSession,
        );

        if (payload.status !== "SUCCESS") {
            const failure = registrationStatusError(payload.status);
            return json({ error: failure.message }, { status: failure.status, headers: noStore });
        }

        cookies.delete(REGISTRATION_SESSION_COOKIE, { path: "/api/v1/register" });
        return json({
            status: "SUCCESS",
            userId: String(payload.userid ?? input.identifier),
            passwordHint: payload.password_hint === "LAST_4_DIGITS" ? "LAST_4_DIGITS" : null,
        }, { headers: noStore });
    } catch (error) {
        if (error instanceof RegistrationApiError) {
            const failure = registrationStatusError(error.payload.status);
            return json({ error: failure.message }, {
                status: error.status >= 400 && error.status < 500 ? error.status : failure.status,
                headers: noStore,
            });
        }
        return json({ error: "Unable to reach the verification service" }, { status: 502, headers: noStore });
    }
}
