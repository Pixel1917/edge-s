import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from './src/lib/plugin/index.js';

export default defineConfig({
	plugins: [sveltekit(), edgesPlugin({ compression: { enabled: true, threshold: 2048 }, isPackageDevelopment: true, silentChromeDevtools: true })],
	server: {
		port: 5178
	}
});
