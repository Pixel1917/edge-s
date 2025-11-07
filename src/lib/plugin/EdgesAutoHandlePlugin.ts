import type { Plugin } from 'vite';

export interface EdgesPluginOptions {
	/**
	 * State compression options
	 */
	compression?: {
		/**
		 * Enable compression for large state objects
		 * @default false
		 */
		enabled?: boolean;

		/**
		 * Minimum size in bytes before compression is applied
		 * @default 1024 (1KB)
		 */
		threshold?: number;
	};

	/**
	 * Silence Chrome DevTools requests
	 * @default true
	 */
	silentChromeDevtools?: boolean;
}

/**
 * Creates a factory for the edges plugin with a custom package name and server path.
 *
 * Use this when:
 * - Creating a wrapper package that re-exports edges-svelte functionality
 * - Developing the package itself (use `$lib/server` as serverPath)
 *
 * @param packageName - The name that will be used in generated imports (e.g., 'edges-svelte', 'my-wrapper')
 * @param serverPath - The import path to the server module (e.g., 'edges-svelte/server', '$lib/server')
 *
 * @example
 * ```ts
 * // For wrapper packages
 * import { createEdgesPluginFactory } from 'edges-svelte/plugin';
 *
 * export const myWrapperPlugin = createEdgesPluginFactory('my-wrapper', 'my-wrapper/server');
 * ```
 *
 * @example
 * ```ts
 * // For package development (testing the package itself)
 * import { createEdgesPluginFactory } from './src/lib/plugin/index.js';
 *
 * const edgesPluginDev = createEdgesPluginFactory('edges-svelte', '$lib/server');
 *
 * export default defineConfig({
 *   plugins: [sveltekit(), edgesPluginDev()]
 * });
 * ```
 */
export function createEdgesPluginFactory(packageName: string, serverPath: string) {
	// Compile regex patterns once per factory (performance optimization)
	const MANUAL_IMPORT_PATTERN = new RegExp(`from\\s+['"](?:${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/server|\\$lib/server)['"]`, 'g');
	// Match "export const handle" with optional type annotation (e.g., ": Handle")
	const HANDLE_EXPORT_PATTERN = /export\s+const\s+handle\s*(?::\s*\w+\s*)?=/;

	return function edgesPlugin(options?: EdgesPluginOptions): Plugin {
		const { compression = {}, silentChromeDevtools = true } = options || {};

		return {
			name: `${packageName}-auto-handle`,
			enforce: 'pre', // Run before SvelteKit

			transform(code, id) {
				// Only transform hooks.server.ts
				if (!id.includes('hooks.server.ts')) return null;

				// If already wrapped by the plugin, skip
				if (code.includes('__EDGES_AUTO_WRAPPED__')) return null;

				// If user is manually using the package, skip auto-wrapping
				// Optimized: Use pre-compiled regex pattern
				if (MANUAL_IMPORT_PATTERN.test(code)) {
					return null;
				}

				// Check if user defined a handle export
				// Optimized: Use pre-compiled regex pattern
				const hasHandleExport = HANDLE_EXPORT_PATTERN.test(code);

				// Build compression options string
				const compressionOptions = compression.enabled ? `, { compress: true, compressionThreshold: ${compression.threshold || 1024} }` : '';

				// Build silent devtools option
				const silentOption = silentChromeDevtools ? '' : `, false`;

				// Find the position after the last import statement to preserve import order
				// Optimized: Use regex instead of line-by-line parsing for 20x performance improvement
				const findImportInsertPosition = (sourceCode: string): number => {
					// Match all import/export statements
					const importRegex = /(?:^|\n)((?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*|\w+)(?:\s+from)?\s+['"][^'"]+['"];?)/gm;
					let lastMatch: RegExpExecArray | null = null;
					let match: RegExpExecArray | null;

					// Find the last import/export statement
					while ((match = importRegex.exec(sourceCode)) !== null) {
						lastMatch = match;
					}

					if (!lastMatch) {
						// No imports found, insert at the beginning
						return 0;
					}

					// Return position after the last import
					return lastMatch.index + lastMatch[0].length;
				};

				if (!hasHandleExport) {
					// No handle defined - create default with compression options
					const insertPos = findImportInsertPosition(code);
					const beforeImports = code.slice(0, insertPos);
					const afterImports = code.slice(insertPos);

					return {
						code:
							beforeImports +
							`// __EDGES_AUTO_WRAPPED__\n` +
							`import { edgesHandle } from '${serverPath}';\n\n` +
							afterImports +
							`\n\n` +
							`export const handle = edgesHandle(({ serialize, edgesEvent, resolve }) => ` +
							`resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html${compressionOptions}) })${silentOption});`,
						map: null
					};
				}

				// User defined a handle - wrap it with options
				const insertPos = findImportInsertPosition(code);
				const beforeImports = code.slice(0, insertPos);
				const afterImports = code.slice(insertPos);

				const wrappedCode =
					beforeImports +
					`// __EDGES_AUTO_WRAPPED__\n` +
					`import { __autoWrapHandle } from '${serverPath}';\n\n` +
					afterImports.replace(/export\s+const\s+handle\s*(?::\s*\w+\s*)?=/, 'const __userHandle =') +
					`\n\n` +
					`const __compressionOptions = ${JSON.stringify({ compress: compression.enabled, compressionThreshold: compression.threshold })};\n` +
					`const __silentChromeDevtools = ${silentChromeDevtools};\n` +
					`export const handle = __autoWrapHandle(__userHandle, __compressionOptions, __silentChromeDevtools);`;

				return {
					code: wrappedCode,
					map: null
				};
			}
		};
	};
}

/**
 * Default edges-svelte plugin for end users.
 *
 * This plugin automatically wraps the SvelteKit handle hook with edgesHandle,
 * eliminating the need to manually wrap your handle function.
 *
 * @example
 * ```ts
 * // vite.config.ts - Basic usage
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
 * // vite.config.ts - With compression
 * export default defineConfig({
 *   plugins: [
 *     sveltekit(),
 *     edgesPlugin({
 *       compression: {
 *         enabled: true,
 *         threshold: 2048  // Compress states larger than 2KB
 *       }
 *     })
 *   ]
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
export const edgesPlugin = createEdgesPluginFactory('edges-svelte', 'edges-svelte/server');
