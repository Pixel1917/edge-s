import type { Plugin } from 'vite';

/**
 * Vite plugin that automatically wraps the SvelteKit handle hook with edgesHandle.
 *
 * This eliminates the need to manually wrap your handle function, while still allowing
 * full customization of the handle logic.
 *
 * @param isPackageDevelopment - Set to `true` when developing the edges-svelte package itself.
 *   This uses `$lib/server` imports. For all other cases (production or consuming the package), use `false` (default).
 *
 * @example
 * ```ts
 * // vite.config.ts (consuming the package)
 * import { sveltekit } from '@sveltejs/kit/vite';
 * import { defineConfig } from 'vite';
 * import { edgesPlugin } from 'edges-svelte/plugin';
 *
 * export default defineConfig({
 *   plugins: [sveltekit(), edgesPlugin()]
 * });
 * ```
 *
 * @example
 * ```ts
 * // vite.config.ts (developing edges-svelte package)
 * import { edgesPlugin } from './src/lib/plugin/index.js';
 *
 * export default defineConfig({
 *   plugins: [sveltekit(), edgesPlugin(true)] // true = package development mode
 * });
 * ```
 *
 * After adding the plugin, you can write your hooks.server.ts normally:
 *
 * @example
 * ```ts
 * // hooks.server.ts - No manual wrapping needed!
 *
 * // Option 1: No handle defined - plugin creates default
 * // (nothing to write, it just works)
 *
 * // Option 2: Custom handle - plugin automatically wraps it
 * export const handle = async ({ event, resolve }) => {
 *   console.log('My custom middleware');
 *   return resolve(event);
 * };
 * ```
 */
export function edgesPlugin(isPackageDevelopment = false): Plugin {
	return {
		name: 'edges-auto-handle',
		enforce: 'pre', // Run before SvelteKit

		transform(code, id) {
			// Only transform hooks.server.ts
			if (!id.includes('hooks.server.ts')) return null;

			// If already wrapped by the plugin, skip
			if (code.includes('__EDGES_AUTO_WRAPPED__')) return null;

			// If user is manually using edges-svelte, skip auto-wrapping
			const hasManualEdgesImport =
				code.includes("from 'edges-svelte/server'") ||
				code.includes('from "edges-svelte/server"') ||
				code.includes("from '$lib/server'") ||
				code.includes('from "$lib/server"');

			if (hasManualEdgesImport) {
				return null;
			}

			// Determine the correct import path
			// If developing the package itself, use $lib
			// Otherwise, use the published package path
			const importPath = isPackageDevelopment ? '$lib/server/index.js' : 'edges-svelte/server';

			// Check if user defined a handle export
			const hasHandleExport = /export\s+const\s+handle/.test(code);

			if (!hasHandleExport) {
				// No handle defined - create default
				return {
					code:
						`// __EDGES_AUTO_WRAPPED__\n` +
						`import { edgesHandle } from '${importPath}';\n\n` +
						code +
						`\n\n` +
						`export const handle = edgesHandle(({ serialize, edgesEvent, resolve }) => ` +
						`resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) }));`,
					map: null
				};
			}

			// User defined a handle - wrap it
			const wrappedCode =
				`// __EDGES_AUTO_WRAPPED__\n` +
				`import { __autoWrapHandle } from '${importPath}';\n\n` +
				code.replace(/export\s+const\s+handle/, 'const __userHandle') +
				`\n\n` +
				`export const handle = __autoWrapHandle(__userHandle);`;

			return {
				code: wrappedCode,
				map: null
			};
		}
	};
}
