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
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
