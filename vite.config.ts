import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from './src/lib/plugin/index.js';

export default defineConfig({
	plugins: [sveltekit(), edgesPlugin(true)],
	server: {
		port: 5178
	}
});
