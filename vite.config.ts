import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { createEdgesPluginFactory } from './src/lib/plugin/index.js';

// For package development, use factory with $lib/server path
const edgesPluginDev = createEdgesPluginFactory('@azure-net/edges', '$lib/server');

export default defineConfig({
	plugins: [
		sveltekit(),
		edgesPluginDev({
			silentChromeDevtools: true
		})
	],
	test: {
		include: ['src/**/*.test.ts'],
		exclude: ['node_modules/**', 'dist/**', '.svelte-kit/**', 'e2e/**']
	},
	server: {
		port: 5178
	}
});
