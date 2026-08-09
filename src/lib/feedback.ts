export const FEEDBACK_MIN_COMMENT_LENGTH = 10;
export const FEEDBACK_MAX_COMMENT_LENGTH = 500;

export type FeedbackCategory = "shop" | "app";
export type FeedbackTopic = "suggestion" | "bug" | "general";

export type FeedbackSubmission =
    | {
          category: "shop";
          outletId: number;
          rating: number;
          comment: string;
      }
    | {
          category: "app";
          topic: FeedbackTopic;
          comment: string;
      };

export type FeedbackValidationResult =
    | { ok: true; value: FeedbackSubmission }
    | { ok: false; message: string };

const FEEDBACK_TOPICS = new Set<FeedbackTopic>([
    "suggestion",
    "bug",
    "general",
]);

export function validateFeedbackInput(
    input: Record<string, unknown>,
): FeedbackValidationResult {
    const category = input.category;
    if (category !== "shop" && category !== "app") {
        return { ok: false, message: "Choose what your feedback is about" };
    }

    const comment = typeof input.comment === "string" ? input.comment.trim() : "";
    if (comment.length < FEEDBACK_MIN_COMMENT_LENGTH) {
        return {
            ok: false,
            message: `Feedback must contain at least ${FEEDBACK_MIN_COMMENT_LENGTH} characters`,
        };
    }
    if (comment.length > FEEDBACK_MAX_COMMENT_LENGTH) {
        return {
            ok: false,
            message: `Feedback cannot exceed ${FEEDBACK_MAX_COMMENT_LENGTH} characters`,
        };
    }

    if (category === "shop") {
        const outletId = Number(input.outletId);
        const rating = Number(input.rating);
        if (!Number.isSafeInteger(outletId) || outletId < 1) {
            return { ok: false, message: "Choose a valid food counter" };
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return { ok: false, message: "Choose a rating from 1 to 5 stars" };
        }
        return { ok: true, value: { category, outletId, rating, comment } };
    }

    const topic = input.topic;
    if (typeof topic !== "string" || !FEEDBACK_TOPICS.has(topic as FeedbackTopic)) {
        return { ok: false, message: "Choose a valid feedback topic" };
    }
    return {
        ok: true,
        value: { category, topic: topic as FeedbackTopic, comment },
    };
}
