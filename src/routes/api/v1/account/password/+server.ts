import { json, type RequestHandler } from "@sveltejs/kit";
import {
    foodcourtApiRequest,
    FoodcourtApiError,
} from "$lib/server/foodcourt-api";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";

const noStore = { "Cache-Control": "no-store" };

type ChangePasswordResponse = {
    success?: boolean;
    status?: string;
    message?: string;
};

export const POST: RequestHandler = async (event) => {
    let body: { currentPassword?: unknown; newPassword?: unknown };
    try {
        body = await event.request.json();
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400, headers: noStore });
    }

    const currentPassword = typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";
    const newPassword = typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    if (!currentPassword) {
        return json(
            { error: "Current password is required" },
            { status: 400, headers: noStore },
        );
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
        return json(
            { error: "New password must be between 6 and 128 characters" },
            { status: 400, headers: noStore },
        );
    }
    if (newPassword === currentPassword) {
        return json(
            { error: "New password must be different from the current password" },
            { status: 400, headers: noStore },
        );
    }

    const session = await resolveEatRightSessionFromEvent(event);
    if (!session.ok) return session.response;
    if (session.userid.trim().toUpperCase().startsWith("GUEST")) {
        return json(
            { error: "Guest accounts cannot change their password" },
            { status: 403, headers: noStore },
        );
    }

    try {
        const payload = await foodcourtApiRequest<ChangePasswordResponse>(
            "/ajax/api/changeUserPassword.jsp",
            {
                method: "POST",
                accessToken: session.accessToken,
                body: new URLSearchParams({ currentPassword, newPassword }),
            },
        );

        if (!payload.success) {
            return json(
                { error: payload.message ?? "Password update failed" },
                { status: 502, headers: noStore },
            );
        }

        return json(
            { success: true, message: payload.message ?? "Password updated successfully" },
            { headers: noStore },
        );
    } catch (error) {
        if (error instanceof FoodcourtApiError) {
            return json(
                { error: error.message },
                { status: error.status, headers: noStore },
            );
        }

        console.error(error);
        return json(
            { error: "Unable to reach the Foodcourt API" },
            { status: 502, headers: noStore },
        );
    }
};
