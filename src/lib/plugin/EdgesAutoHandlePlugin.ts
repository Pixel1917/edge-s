import type { Plugin } from 'vite';

export interface EdgesPluginOptions {
	compression?: {
		enabled?: boolean;
		threshold?: number;
	};
	silentChromeDevtools?: boolean;
}

/**
 * Creates a factory for the edges plugin with a custom package name and server path.
 *
 * Use this when:
 * - Creating a wrapper package that re-exports edges-svelte functionality
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
			enforce: 'pre',

			transform(code, id) {
				if (!id.includes('hooks.server.ts')) return null;

				if (code.includes('__EDGES_AUTO_WRAPPED__')) return null;

				if (MANUAL_IMPORT_PATTERN.test(code)) {
					return null;
				}

				const hasHandleExport = HANDLE_EXPORT_PATTERN.test(code);

				const compressionOptions = compression.enabled ? `, { compress: true, compressionThreshold: ${compression.threshold || 1024} }` : '';

				const silentOption = silentChromeDevtools ? '' : `, false`;

				const findImportInsertPosition = (sourceCode: string): number => {
					const importRegex = /(?:^|\n)((?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*|\w+)(?:\s+from)?\s+['"][^'"]+['"];?)/gm;
					let lastMatch: RegExpExecArray | null = null;
					let match: RegExpExecArray | null;

					while ((match = importRegex.exec(sourceCode)) !== null) {
						lastMatch = match;
					}

					if (!lastMatch) {
						return 0;
					}

					return lastMatch.index + lastMatch[0].length;
				};

				if (!hasHandleExport) {
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
 *
 * This plugin automatically wraps the SvelteKit handle hook with edgesHandle,
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
 */
export const edgesPlugin = createEdgesPluginFactory('edges-svelte', 'edges-svelte/server');
