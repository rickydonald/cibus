type VisibilityPollerOptions = {
    intervalMs: number;
    poll: () => Promise<void>;
    shouldPoll?: () => boolean;
};

export type VisibilityPoller = {
    refresh: () => Promise<void>;
    stop: () => void;
};

/**
 * Low-impact polling for live UI hints.
 *
 * Only one request can run at a time. Scheduled requests pause while the tab
 * is hidden or offline, and a stale status is refreshed when the user returns.
 */
export function createVisibilityPoller({
    intervalMs,
    poll,
    shouldPoll = () => true,
}: VisibilityPollerOptions): VisibilityPoller {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: Promise<void> | undefined;
    let lastFinishedAt = Date.now();

    function clearTimer() {
        if (timer) clearTimeout(timer);
        timer = undefined;
    }

    function schedule(delay = intervalMs) {
        clearTimer();
        if (stopped || document.hidden || !navigator.onLine) return;
        timer = setTimeout(() => void run(false), Math.max(delay, 0));
    }

    async function run(force: boolean): Promise<void> {
        if (stopped) return;
        if (running) return running;

        if (!force && (document.hidden || !navigator.onLine || !shouldPoll())) {
            schedule();
            return;
        }

        running = poll()
            .catch(() => {
                // The caller owns its UI error state. Keeping the scheduler
                // alive lets a transient network issue recover automatically.
            })
            .finally(() => {
                running = undefined;
                lastFinishedAt = Date.now();
                schedule();
            });
        return running;
    }

    function refreshIfStale() {
        if (stopped || document.hidden || !navigator.onLine) return;
        const elapsed = Date.now() - lastFinishedAt;
        if (elapsed >= intervalMs && shouldPoll()) {
            void run(false);
        } else {
            schedule(intervalMs - elapsed);
        }
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            clearTimer();
        } else {
            refreshIfStale();
        }
    }

    function handleOnline() {
        if (shouldPoll()) void run(false);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", refreshIfStale);
    schedule();

    return {
        refresh: () => run(true),
        stop: () => {
            stopped = true;
            clearTimer();
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("focus", refreshIfStale);
        },
    };
}
