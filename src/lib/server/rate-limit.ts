import { createHash } from "node:crypto";
import { json, type RequestEvent } from "@sveltejs/kit";

const MAX_BUCKETS = 10_000;

export const DEFAULT_RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

export type RateLimitRule = {
    namespace: string;
    identifier: string;
    limit: number;
    windowMs: number;
};

export function formatRetryAfter(seconds: number): string {
    const safeSeconds = Math.max(1, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    if (minutes === 0) return `${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
    if (remainingSeconds === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    return `${minutes} minute${minutes === 1 ? "" : "s"} ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
}

const buckets = new Map<string, RateLimitBucket>();

function hashIdentifier(identifier: string) {
    return createHash("sha256").update(identifier).digest("base64url");
}

function cleanupBuckets(now: number) {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }

    while (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value;
        if (typeof oldestKey !== "string") break;
        buckets.delete(oldestKey);
    }
}

function consumeRule(rule: RateLimitRule, now: number): number | null {
    const key = `${rule.namespace}:${hashIdentifier(rule.identifier)}`;
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
        if (buckets.size >= MAX_BUCKETS) cleanupBuckets(now);
        buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
        return null;
    }

    if (existing.count >= rule.limit) {
        return Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    }

    existing.count += 1;
    return null;
}

function getClientIdentifier(event: RequestEvent) {
    try {
        return event.getClientAddress();
    } catch {
        return "unknown-client";
    }
}

export function enforceRateLimits(
    event: RequestEvent,
    rules: Array<Omit<RateLimitRule, "identifier"> & { identifier?: string }>,
): Response | null {
    const now = Date.now();
    const clientIdentifier = getClientIdentifier(event);
    let retryAfter = 0;

    for (const rule of rules) {
        retryAfter = Math.max(
            retryAfter,
            consumeRule(
                { ...rule, identifier: rule.identifier ?? clientIdentifier },
                now,
            ) ?? 0,
        );
    }

    if (retryAfter === 0) return null;
    return json(
        {
            error: `Too many attempts. Try again in ${formatRetryAfter(retryAfter)}.`,
            errorCode: "rate_limited",
            retryAfterSeconds: retryAfter,
        },
        {
            status: 429,
            headers: {
                "Cache-Control": "no-store",
                "Retry-After": String(retryAfter),
            },
        },
    );
}
