<script lang="ts">
    import { onMount } from "svelte";
    import MainContainer from "$lib/components/ui/MainContainer.svelte";
    import ContentWrapper from "$lib/components/ui/ContentWrapper.svelte";
    import StarRating from "$lib/components/custom/StarRating.svelte";
    import {
        BugIcon,
        CheckIcon,
        LightbulbIcon,
        MessageSquareTextIcon,
        SendIcon,
        SmartphoneIcon,
        StoreIcon,
    } from "@lucide/svelte";
    import {
        ArrowLeftIcon,
        RefreshCw01Icon,
        XCloseIcon,
    } from "@untitled-theme/icons-svelte";
    import helpers from "$lib/helpers";
    import { normalizeStoreName } from "$lib/utils/display-text";
    import { contentReveal } from "$lib/utils/transitions";
    import {
        fetchEatRight,
        redirectIfEatRightConnectRequired,
    } from "$lib/utils/eatright-client";

    type Outlet = {
        id: number;
        name: string;
        shopNo: number;
        isClosed: boolean;
    };

    type Category = "shop" | "app";
    type AppTopic = "suggestion" | "bug" | "general";

    const MIN_COMMENT = 10;
    const MAX_COMMENT = 500;

    const CATEGORIES: {
        id: Category;
        label: string;
        hint: string;
        icon: typeof StoreIcon;
    }[] = [
        {
            id: "shop",
            label: "Shops",
            hint: "Rate a food counter",
            icon: StoreIcon,
        },
        {
            id: "app",
            label: "Application",
            hint: "Bugs & suggestions",
            icon: SmartphoneIcon,
        },
    ];

    const APP_TOPICS: {
        id: AppTopic;
        label: string;
        hint: string;
        icon: typeof StoreIcon;
        prompt: string;
        placeholder: string;
    }[] = [
        {
            id: "suggestion",
            label: "Suggestion",
            hint: "An idea that would make the app better",
            icon: LightbulbIcon,
            prompt: "What would you like to see?",
            placeholder:
                "Describe the change you have in mind and where it would help.",
        },
        {
            id: "bug",
            label: "Report a bug",
            hint: "Something is broken or behaving oddly",
            icon: BugIcon,
            prompt: "What went wrong?",
            placeholder:
                "What were you doing, what happened, and what did you expect instead?",
        },
        {
            id: "general",
            label: "General feedback",
            hint: "Anything else you'd like to tell us",
            icon: MessageSquareTextIcon,
            prompt: "What's on your mind?",
            placeholder: "Tell us what's working well and what isn't.",
        },
    ];

    let category = $state<Category | null>(null);

    // Shops branch
    let outlets = $state<Outlet[]>([]);
    let isLoadingOutlets = $state(false);
    let outletsError = $state("");
    let selectedOutletId = $state<number | null>(null);
    let rating = $state(0);
    let shopComment = $state("");

    // Application branch
    let appTopic = $state<AppTopic | null>(null);
    let appComment = $state("");

    let formError = $state("");
    let isSubmitted = $state(false);
    let isSubmitting = $state(false);

    const comment = $derived(category === "shop" ? shopComment : appComment);
    const commentLength = $derived(comment.trim().length);
    const remaining = $derived(MIN_COMMENT - commentLength);
    const activeTopic = $derived(
        APP_TOPICS.find((topic) => topic.id === appTopic) ?? null,
    );
    const selectedOutlet = $derived(
        outlets.find((outlet) => outlet.id === selectedOutletId) ?? null,
    );

    async function loadOutlets() {
        if (isLoadingOutlets) return;
        isLoadingOutlets = true;
        outletsError = "";
        try {
            const response = await fetchEatRight("/api/v1/outlets");
            const data = await response.json();

            if (!response.ok || data.error) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) {
                    return;
                }
                throw new Error(data.error ?? "Unable to load food counters");
            }

            outlets = data;
        } catch (error) {
            console.error(error);
            outletsError = "We couldn't load the food counters.";
        } finally {
            isLoadingOutlets = false;
        }
    }

    onMount(loadOutlets);

    function selectCategory(next: Category) {
        category = next;
        formError = "";
        if (next === "shop" && outlets.length === 0 && !isLoadingOutlets) {
            loadOutlets();
        }
    }

    function validate(): string | null {
        if (!category) return "Pick what your feedback is about.";

        if (category === "shop") {
            if (selectedOutletId === null) {
                return "Select the food counter you're rating.";
            }
            if (rating === 0) return "Give the counter a star rating.";
        } else if (!appTopic) {
            return "Choose the kind of feedback you're sending.";
        }

        if (commentLength < MIN_COMMENT) {
            return `Write at least ${MIN_COMMENT} characters so we know what to act on.`;
        }
        return null;
    }

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault();
        if (isSubmitting) return;

        const validationError = validate();
        if (validationError) {
            formError = validationError;
            return;
        }

        formError = "";
        isSubmitting = true;
        try {
            const payload =
                category === "shop"
                    ? {
                          category,
                          outletId: selectedOutletId,
                          rating,
                          comment: shopComment,
                      }
                    : { category, topic: appTopic, comment: appComment };
            const response = await fetchEatRight("/api/v1/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                if (await redirectIfEatRightConnectRequired(data.errorCode)) return;
                throw new Error(data.error ?? "We couldn't save your feedback.");
            }
            isSubmitted = true;
        } catch (error) {
            formError =
                error instanceof Error
                    ? error.message
                    : "We couldn't save your feedback.";
        } finally {
            isSubmitting = false;
        }
    }

    function resetForm() {
        category = null;
        selectedOutletId = null;
        rating = 0;
        shopComment = "";
        appTopic = null;
        appComment = "";
        formError = "";
        isSubmitted = false;
        isSubmitting = false;
    }
</script>

<MainContainer>
    <div class="min-h-screen text-ink antialiased">
        <!-- Header -->
        <div class="page-header">
            <div
                class="safe-top-offset flex items-center gap-4 px-6 py-4 max-w-md mx-auto lg:max-w-2xl"
            >
                <a
                    href="/view/settings"
                    class="icon-btn"
                    aria-label="Back to settings"
                >
                    <ArrowLeftIcon class="h-4 w-4" />
                </a>

                <div>
                    <h1 class="text-lg font-bold tracking-tight text-ink">
                        Feedback
                    </h1>
                    <p class="text-xs font-medium text-ink-muted">
                        Tell us what's working and what isn't
                    </p>
                </div>
            </div>
        </div>

        <div>
            <ContentWrapper>
                <div class="px-5 pb-12 pt-4 max-w-md mx-auto lg:max-w-2xl">
                    {#if isSubmitted}
                        <!-- Confirmation -->
                        <section
                            class="card flex flex-col items-center px-6 py-10 text-center"
                            in:contentReveal={{ duration: 320 }}
                        >
                            <div
                                class="grid h-14 w-14 place-items-center rounded-circle bg-success-soft text-success"
                            >
                                <CheckIcon size={26} strokeWidth={2.4} />
                            </div>
                            <h2
                                class="mt-4 text-lg font-bold tracking-tight text-ink"
                            >
                                Thanks for the feedback
                            </h2>
                            <p
                                class="mt-1.5 max-w-xs text-sm font-medium leading-6 text-ink-muted"
                            >
                                {#if category === "shop" && selectedOutlet}
                                    Your {rating}-star rating for {normalizeStoreName(
                                        selectedOutlet.name,
                                    )} has been noted.
                                {:else}
                                    We read every message and use it to shape
                                    what we build next.
                                {/if}
                            </p>
                            <button
                                type="button"
                                class="btn-quiet mt-6 h-11 px-5 text-sm"
                                onclick={resetForm}
                            >
                                Send more feedback
                            </button>
                        </section>
                    {:else}
                        {#snippet commentMeta()}
                            <div
                                class="mt-2 flex items-start justify-between gap-3 px-1"
                            >
                                <p
                                    class="text-xs font-medium {commentLength >=
                                    MIN_COMMENT
                                        ? 'text-success'
                                        : 'text-ink-faint'}"
                                >
                                    {#if commentLength === 0}
                                        Minimum {MIN_COMMENT} characters
                                    {:else if remaining > 0}
                                        {remaining} more character{remaining ===
                                        1
                                            ? ""
                                            : "s"} needed
                                    {:else}
                                        Looks good
                                    {/if}
                                </p>
                                <p
                                    class="shrink-0 text-xs font-medium tabular-nums text-ink-faint"
                                >
                                    {comment.length}/{MAX_COMMENT}
                                </p>
                            </div>
                        {/snippet}

                        <form class="space-y-4" onsubmit={handleSubmit}>
                            <!-- Step 1 — category -->
                            <section class="card p-5">
                                <p class="section-label">Step 1</p>
                                <h2
                                    id="category-label"
                                    class="mt-1 text-base font-bold tracking-tight text-ink"
                                >
                                    What's your feedback about?
                                </h2>

                                <div
                                    class="mt-4 grid grid-cols-2 gap-3"
                                    role="radiogroup"
                                    aria-labelledby="category-label"
                                >
                                    {#each CATEGORIES as option (option.id)}
                                        {@const isSelected =
                                            category === option.id}
                                        <label class="block cursor-pointer">
                                            <input
                                                type="radio"
                                                name="feedback-category"
                                                value={option.id}
                                                checked={isSelected}
                                                onchange={() =>
                                                    selectCategory(option.id)}
                                                class="peer sr-only"
                                            />
                                            <span
                                                class="relative flex h-full flex-col gap-3 rounded-2xl border p-4 transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary {isSelected
                                                    ? 'border-primary bg-primary-soft'
                                                    : 'border-line bg-surface hover:border-line-strong'}"
                                            >
                                                <span
                                                    class="flex h-11 w-11 items-center justify-center rounded-xl border transition-colors {isSelected
                                                        ? 'border-primary/10 bg-surface text-primary'
                                                        : 'border-line bg-canvas text-ink-faint'}"
                                                >
                                                    <option.icon
                                                        size={20}
                                                        strokeWidth={2}
                                                    />
                                                </span>
                                                <span class="block">
                                                    <span
                                                        class="block text-sm font-bold tracking-tight text-ink"
                                                    >
                                                        {option.label}
                                                    </span>
                                                    <span
                                                        class="mt-0.5 block text-xs font-medium leading-4 text-ink-muted"
                                                    >
                                                        {option.hint}
                                                    </span>
                                                </span>

                                                {#if isSelected}
                                                    <span
                                                        class="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-circle bg-primary text-white"
                                                    >
                                                        <CheckIcon
                                                            size={12}
                                                            strokeWidth={3}
                                                        />
                                                    </span>
                                                {/if}
                                            </span>
                                        </label>
                                    {/each}
                                </div>
                            </section>

                            {#if category === "shop"}
                                <!-- Step 2 — counter -->
                                <section
                                    class="card p-5"
                                    in:contentReveal={{ duration: 260 }}
                                >
                                    <p class="section-label">Step 2</p>
                                    <h2
                                        id="outlet-label"
                                        class="mt-1 text-base font-bold tracking-tight text-ink"
                                    >
                                        Which counter?
                                    </h2>

                                    <div class="mt-4">
                                        {#if isLoadingOutlets}
                                            <div class="flex flex-col gap-2">
                                                {#each Array(3) as _}
                                                    <div
                                                        class="flex items-center gap-3.5 rounded-2xl border border-line p-3"
                                                    >
                                                        <div
                                                            class="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-canvas"
                                                        ></div>
                                                        <div
                                                            class="flex-1 space-y-2"
                                                        >
                                                            <div
                                                                class="h-3.5 w-1/2 animate-pulse rounded bg-canvas"
                                                            ></div>
                                                            <div
                                                                class="h-3 w-1/4 animate-pulse rounded bg-canvas"
                                                            ></div>
                                                        </div>
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else if outletsError}
                                            <div
                                                class="flex flex-col items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-7 text-center"
                                            >
                                                <div
                                                    class="grid h-11 w-11 place-items-center rounded-circle bg-danger-soft text-danger"
                                                >
                                                    <XCloseIcon
                                                        class="h-5 w-5"
                                                    />
                                                </div>
                                                <p
                                                    class="text-sm font-medium text-ink-muted"
                                                >
                                                    {outletsError}
                                                </p>
                                                <button
                                                    type="button"
                                                    class="btn-quiet h-10 px-4 text-sm"
                                                    onclick={loadOutlets}
                                                >
                                                    <RefreshCw01Icon
                                                        class="h-4 w-4"
                                                    />
                                                    Try again
                                                </button>
                                            </div>
                                        {:else}
                                            <div
                                                class="flex flex-col gap-2"
                                                role="radiogroup"
                                                aria-labelledby="outlet-label"
                                            >
                                                {#each outlets as outlet (outlet.id)}
                                                    {@const isSelected =
                                                        selectedOutletId ===
                                                        outlet.id}
                                                    <label
                                                        class="block cursor-pointer"
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="feedback-outlet"
                                                            value={outlet.id}
                                                            bind:group={
                                                                selectedOutletId
                                                            }
                                                            class="peer sr-only"
                                                        />
                                                        <span
                                                            class="flex items-center gap-3.5 rounded-2xl border p-3 transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary {isSelected
                                                                ? 'border-primary bg-primary-soft'
                                                                : 'border-line bg-surface hover:border-line-strong'}"
                                                        >
                                                            <span
                                                                class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/10 bg-primary-soft"
                                                            >
                                                                <img
                                                                    src={helpers.mapStoreIcon(
                                                                        String(
                                                                            outlet.shopNo,
                                                                        ),
                                                                    )}
                                                                    alt=""
                                                                    class="h-7 w-7 object-contain"
                                                                />
                                                            </span>
                                                            <span
                                                                class="min-w-0 flex-1"
                                                            >
                                                                <span
                                                                    class="block truncate text-sm font-semibold tracking-tight text-ink"
                                                                >
                                                                    {normalizeStoreName(
                                                                        outlet.name,
                                                                    )}
                                                                </span>
                                                                <span
                                                                    class="mt-0.5 block text-xs font-medium text-ink-faint"
                                                                >
                                                                    Counter {outlet.shopNo}
                                                                </span>
                                                            </span>
                                                            <span
                                                                class="grid h-5 w-5 shrink-0 place-items-center rounded-circle border transition-colors {isSelected
                                                                    ? 'border-primary bg-primary text-white'
                                                                    : 'border-line-strong bg-surface text-transparent'}"
                                                            >
                                                                <CheckIcon
                                                                    size={12}
                                                                    strokeWidth={3}
                                                                />
                                                            </span>
                                                        </span>
                                                    </label>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                </section>

                                <!-- Step 3 — rating + comment -->
                                <section
                                    class="card p-5"
                                    in:contentReveal={{ duration: 260 }}
                                >
                                    <p class="section-label">Step 3</p>
                                    <h2
                                        class="mt-1 text-base font-bold tracking-tight text-ink"
                                    >
                                        How was it?
                                    </h2>

                                    <div
                                        class="mt-5 rounded-2xl border border-line bg-canvas px-4 py-5"
                                    >
                                        <StarRating
                                            bind:value={rating}
                                            name="feedback-rating"
                                        />
                                    </div>

                                    <div class="mt-5">
                                        <label
                                            for="shop-comment"
                                            class="pl-1 text-sm font-medium text-ink-muted"
                                        >
                                            Tell us more
                                        </label>
                                        <textarea
                                            id="shop-comment"
                                            bind:value={shopComment}
                                            maxlength={MAX_COMMENT}
                                            rows="4"
                                            placeholder="How were the food, the service and the wait?"
                                            class="field-input mt-1.5 min-h-30 resize-none leading-6"
                                        ></textarea>

                                        {@render commentMeta()}
                                    </div>
                                </section>
                            {/if}

                            {#if category === "app"}
                                <!-- Step 2 — topic -->
                                <section
                                    class="card p-5"
                                    in:contentReveal={{ duration: 260 }}
                                >
                                    <p class="section-label">Step 2</p>
                                    <h2
                                        id="topic-label"
                                        class="mt-1 text-base font-bold tracking-tight text-ink"
                                    >
                                        What kind of feedback?
                                    </h2>

                                    <div
                                        class="mt-4 flex flex-col gap-2"
                                        role="radiogroup"
                                        aria-labelledby="topic-label"
                                    >
                                        {#each APP_TOPICS as topic (topic.id)}
                                            {@const isSelected =
                                                appTopic === topic.id}
                                            <label class="block cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="feedback-topic"
                                                    value={topic.id}
                                                    bind:group={appTopic}
                                                    class="peer sr-only"
                                                />
                                                <span
                                                    class="flex items-center gap-3.5 rounded-2xl border p-3 transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary {isSelected
                                                        ? 'border-primary bg-primary-soft'
                                                        : 'border-line bg-surface hover:border-line-strong'}"
                                                >
                                                    <span
                                                        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors {isSelected
                                                            ? 'border-primary/10 bg-surface text-primary'
                                                            : 'border-line bg-canvas text-ink-faint'}"
                                                    >
                                                        <topic.icon
                                                            size={19}
                                                            strokeWidth={2}
                                                        />
                                                    </span>
                                                    <span
                                                        class="min-w-0 flex-1"
                                                    >
                                                        <span
                                                            class="block text-sm font-semibold tracking-tight text-ink"
                                                        >
                                                            {topic.label}
                                                        </span>
                                                        <span
                                                            class="mt-0.5 block text-xs font-medium leading-4 text-ink-muted"
                                                        >
                                                            {topic.hint}
                                                        </span>
                                                    </span>
                                                    <span
                                                        class="grid h-5 w-5 shrink-0 place-items-center rounded-circle border transition-colors {isSelected
                                                            ? 'border-primary bg-primary text-white'
                                                            : 'border-line-strong bg-surface text-transparent'}"
                                                    >
                                                        <CheckIcon
                                                            size={12}
                                                            strokeWidth={3}
                                                        />
                                                    </span>
                                                </span>
                                            </label>
                                        {/each}
                                    </div>
                                </section>

                                <!-- Step 3 — details -->
                                {#if activeTopic}
                                    <section
                                        class="card p-5"
                                        in:contentReveal={{ duration: 260 }}
                                    >
                                        <p class="section-label">Step 3</p>
                                        <h2
                                            class="mt-1 text-base font-bold tracking-tight text-ink"
                                        >
                                            {activeTopic.prompt}
                                        </h2>

                                        <div class="mt-4">
                                            <textarea
                                                id="app-comment"
                                                bind:value={appComment}
                                                maxlength={MAX_COMMENT}
                                                rows="5"
                                                placeholder={activeTopic.placeholder}
                                                aria-label={activeTopic.prompt}
                                                class="field-input min-h-36 resize-none leading-6"
                                            ></textarea>

                                            {@render commentMeta()}
                                        </div>
                                    </section>
                                {/if}
                            {/if}

                            {#if category}
                                <div
                                    class="space-y-3 pt-1"
                                    in:contentReveal={{ duration: 260 }}
                                >
                                    {#if formError}
                                        <div
                                            class="rounded-2xl border border-danger/10 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
                                            role="alert"
                                        >
                                            {formError}
                                        </div>
                                    {/if}

                                    <button
                                        type="submit"
                                        class="btn-primary h-13 w-full text-sm"
                                        disabled={isSubmitting}
                                    >
                                        {#if isSubmitting}
                                            <RefreshCw01Icon
                                                class="h-4 w-4 animate-spin"
                                            />
                                            Sending feedback...
                                        {:else}
                                            <SendIcon
                                                size={16}
                                                strokeWidth={2.2}
                                            />
                                            Submit feedback
                                        {/if}
                                    </button>
                                </div>
                            {/if}
                        </form>
                    {/if}
                </div>
            </ContentWrapper>
        </div>
    </div>
</MainContainer>
