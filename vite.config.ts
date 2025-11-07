import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { createEdgesPluginFactory } from './src/lib/plugin/index.js';

// For package development, use factory with $lib/server path
const edgesPluginDev = createEdgesPluginFactory('edges-svelte', '$lib/server');

export default defineConfig({
	plugins: [
		sveltekit(),
		edgesPluginDev({
			compression: { enabled: true, threshold: 2048 },
			silentChromeDevtools: true
		})
	],
	server: {
		port: 5178
	}
});
