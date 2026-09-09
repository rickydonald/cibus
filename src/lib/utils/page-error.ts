const messages: Record<number, { title: string; description: string }> = {
    400: { title: "We couldn’t open that page", description: "Something in this link doesn’t look right. Head home and try again from there." },
    401: { title: "Let’s get you signed in", description: "Sign in to your Eat Right account to continue." },
    403: { title: "This page isn’t available to you", description: "Your account doesn’t have access to this page. You can head home to continue." },
    404: { title: "This page is off the menu", description: "The link may have changed, or the page may no longer exist. Let’s get you back to Eat Right." },
    408: { title: "That took a little too long", description: "We couldn’t load this page in time. Check your connection and try again." },
    410: { title: "This page is no longer on the menu", description: "This page has been removed. Head home to find what’s available now." },
    429: { title: "Let’s take a short breather", description: "There have been too many requests. Wait a moment before trying again." },
    503: { title: "We’re temporarily unavailable", description: "Eat Right can’t serve this page right now. Please try again in a little while." },
    504: { title: "That took a little too long", description: "We’re having trouble getting a response. Please try again in a moment." },
};

export function getPageError(status: number) {
    return {
        ...(messages[status] ?? {
            title: "Something didn’t go as planned",
            description: "We couldn’t load this page. Please try again in a moment, or head home to continue.",
        }),
        retry: status === 408 || status === 429 || status >= 500,
        homeHref: status === 401 ? "/login" : "/",
        homeLabel: status === 401 ? "Sign in" : "Back to home",
    };
}
