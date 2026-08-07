// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			eatRightAuth: import("$lib/server/eatright").EatRightAuthSession | null;
			eatRightAuthError: import("$lib/server/eatright").EatRightAuthErrorCode | null;
		}
		// interface PageData {}
		interface PageState {
			/**
			 * Set by the cart when checkout succeeds, so the confirmation
			 * page knows to play its "order placed" celebration. It is
			 * cleared on arrival — refreshing or returning through history
			 * shows the receipt directly.
			 */
			orderPlaced?: {
				total: number;
				counters: number;
				items: number;
			};
		}
		// interface Platform {}
	}
}

export {};
