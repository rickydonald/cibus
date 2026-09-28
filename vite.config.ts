import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		// Lowest stable native-module browsers supported by Vite. This keeps one
		// production bundle while covering iOS 12 and Chrome-era Android phones.
		target: ['es2018', 'chrome64', 'edge79', 'firefox67', 'safari12', 'ios12']
	},
	server: {
		allowedHosts: ['er.rdmw.net']
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			serviceWorker: {
				// Registration is handled in the root layout so updates can switch
				// atomically. Launch images are OS-only and should not inflate the
				// service worker's runtime asset list.
				register: false,
				files: (file) => !file.startsWith('splash/') && file !== '.DS_Store'
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	]
});
