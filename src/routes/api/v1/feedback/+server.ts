import { json, type RequestHandler } from "@sveltejs/kit";
import { validateFeedbackInput } from "$lib/feedback";
import { resolveEatRightSessionFromEvent } from "$lib/server/eatright";
import {
    foodcourtApiRequest,
    FoodcourtApiError,
} from "$lib/server/foodcourt-api";
import { DEV_MODE } from "$lib/server/dev";
import {
    DEFAULT_RATE_LIMIT_WINDOW_MS,
    enforceRateLimits,
} from "$lib/server/rate-limit";

const MAX_REQUEST_BYTES = 4 * 1024;
const noStore = { "Cache-Control": "no-store" };

type FeedbackBackendResponse = {
    success?: boolean;
    status?: string;
    message?: string;
    errorCode?: string;
    id?: number;
    retryAfterSeconds?: number;
};

export const POST: RequestHandler = async (event) => {
    const contentLength = Number(event.request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return json(
            { error: "Feedback request is too large", errorCode: "request_too_large" },
            { status: 413, headers: noStore },
        );
    }

    let body: Record<string, unknown>;
    try {
        const value = await event.request.json();
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("invalid body");
        }
        body = value as Record<string, unknown>;
    } catch {
        return json(
            { error: "Invalid feedback request", errorCode: "invalid_json" },
            { status: 400, headers: noStore },
        );
    }

    const validated = validateFeedbackInput(body);
    if (!validated.ok) {
        return json(
            { error: validated.message, errorCode: "feedback_invalid" },
            { status: 400, headers: noStore },
        );
    }

    const session = await resolveEatRightSessionFromEvent(event);
    if (!session.ok) return session.response;

    const rateLimited = enforceRateLimits(event, [
        {
            namespace: "feedback:ip",
            limit: 10,
            windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
        },
        {
            namespace: "feedback:user",
            identifier: session.userid,
            limit: 5,
            windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
        },
    ]);
    if (rateLimited) return rateLimited;

    if (DEV_MODE) {
        return json({ success: true, id: Date.now() }, { headers: noStore });
    }

    const feedback = validated.value;
    const form = new URLSearchParams({
        category: feedback.category,
        comments: feedback.comment,
    });
    if (feedback.category === "shop") {
        form.set("outletid", String(feedback.outletId));
        form.set("rating", String(feedback.rating));
    } else {
        form.set("topic", feedback.topic);
    }

    try {
        const payload = await foodcourtApiRequest<FeedbackBackendResponse>(
            "/ajax/FeedbackController.jsp",
            {
                method: "POST",
                accessToken: session.accessToken,
                body: form,
            },
        );
        if (!payload.success || !Number.isSafeInteger(Number(payload.id))) {
            return json(
                { error: payload.message ?? "Feedback could not be saved" },
                { status: 502, headers: noStore },
            );
        }
        return json({ success: true, id: Number(payload.id) }, { headers: noStore });
    } catch (error) {
        if (error instanceof FoodcourtApiError) {
            const payload =
                error.payload && typeof error.payload === "object"
                    ? (error.payload as FeedbackBackendResponse)
                    : null;
            const headers: Record<string, string> = { ...noStore };
            if (error.status === 429 && payload?.retryAfterSeconds) {
                headers["Retry-After"] = String(payload.retryAfterSeconds);
            }
            return json(
                {
                    error: error.message,
                    errorCode: payload?.errorCode ?? "feedback_failed",
                    retryAfterSeconds: payload?.retryAfterSeconds,
                },
                { status: error.status, headers },
            );
        }
        console.error(error);
        return json(
            { error: "Unable to reach the feedback service" },
            { status: 502, headers: noStore },
        );
    }
};
