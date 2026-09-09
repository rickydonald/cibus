<script lang="ts">
    import { page } from "$app/state";
    import { ArrowRight, RotateCcw, UtensilsCrossed } from "@lucide/svelte";
    import { getPageError } from "$lib/utils/page-error";

    const error = $derived(getPageError(page.status));
</script>

<svelte:head>
    <title>{page.status} · {error.title} | Eat Right</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<main class="error-shell flex min-h-dvh flex-col items-center bg-canvas px-5 text-center sm:px-8">
    <a href="/" data-sveltekit-reload class="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Eat Right home">
        <span class="block font-display text-2xl font-semibold tracking-tight text-ink">Eat Right</span>
        <span class="mt-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-ink-faint">Loyola College</span>
    </a>

    <div class="flex w-full max-w-lg flex-1 flex-col justify-center py-10 sm:py-14">
        <section class="card px-6 py-9 sm:px-10 sm:py-11" aria-labelledby="error-title">
            <div aria-hidden="true" class="mx-auto grid h-14 w-14 place-items-center rounded-circle border border-primary/10 bg-primary-soft text-primary-ink">
                <UtensilsCrossed size={24} strokeWidth={1.6} />
            </div>
            <p class="mt-5 font-display text-[5rem] leading-none tracking-[-0.06em] text-primary-ink sm:text-[6rem]">
                <span class="sr-only">Error </span>{page.status}
            </p>
            <h1 id="error-title" class="mt-5 text-balance font-display text-[1.9rem] leading-[1.15] tracking-tight text-ink sm:text-[2.25rem]">{error.title}</h1>
            <p class="mx-auto mt-4 max-w-sm text-pretty text-sm leading-6 text-ink-muted">{error.description}</p>

            <div class="mt-8 flex flex-col gap-3">
                {#if error.retry}
                    <!-- A document GET also recovers from a failed client bundle without resubmitting a form. -->
                    <a href={page.url.pathname + page.url.search} data-sveltekit-reload class="btn-primary min-h-13 px-5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                        <RotateCcw size={17} aria-hidden="true" /> Try again
                    </a>
                {/if}
                <a href={error.homeHref} data-sveltekit-reload class="{error.retry ? 'btn-quiet' : 'btn-primary'} min-h-13 px-5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                    {error.homeLabel} <ArrowRight size={17} aria-hidden="true" />
                </a>
            </div>
        </section>
    </div>
</main>

<style>
    .error-shell {
        padding-top: max(2rem, env(safe-area-inset-top));
        padding-bottom: max(1rem, env(safe-area-inset-bottom));
    }
</style>
