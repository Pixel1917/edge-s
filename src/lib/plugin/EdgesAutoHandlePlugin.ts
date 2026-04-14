import type { Plugin } from 'vite';

export interface EdgesPluginOptions {
	compression?: {
		enabled?: boolean;
		threshold?: number;
	};
	silentChromeDevtools?: boolean;
	syncFromServer?: boolean;
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
	const LOAD_EXPORT_PATTERN = /export\s+const\s+load\s*(?::\s*[^=]+)?=/;
	const ACTIONS_EXPORT_PATTERN = /export\s+const\s+actions\s*(?::\s*[^=]+)?=/;
	const SERVER_ROUTE_PATTERN = /[\\/]\+((page|layout)\.server)\.(t|j)s$/;
	const UNIVERSAL_ROUTE_PATTERN = /[\\/]\+((page|layout))\.(t|j)s$/;

	return function edgesPlugin(options?: EdgesPluginOptions): Plugin {
		const { compression = {}, silentChromeDevtools = true, syncFromServer = true } = options || {};

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

		const ensureSyncImport = (sourceCode: string) => {
			if (sourceCode.includes('__EDGES_SYNC_WRAPPED__')) return sourceCode;
			const insertPos = findImportInsertPosition(sourceCode);
			const beforeImports = sourceCode.slice(0, insertPos);
			const afterImports = sourceCode.slice(insertPos);
			return `${beforeImports}\n// __EDGES_SYNC_WRAPPED__\nimport { __withEdgesServerLoad, __withEdgesActions, __withEdgesUniversalLoad } from '${serverPath}';\n${afterImports}`;
		};

		const wrapServerRouteModule = (sourceCode: string) => {
			if (!LOAD_EXPORT_PATTERN.test(sourceCode) && !ACTIONS_EXPORT_PATTERN.test(sourceCode)) {
				return null;
			}
			let wrapped = ensureSyncImport(sourceCode);

			if (LOAD_EXPORT_PATTERN.test(wrapped)) {
				wrapped = wrapped
					.replace(LOAD_EXPORT_PATTERN, (match) => match.replace('export const load', 'const __userLoad'))
					.concat('\n\nexport const load = __withEdgesServerLoad(__userLoad);');
			}

			if (ACTIONS_EXPORT_PATTERN.test(wrapped)) {
				wrapped = wrapped
					.replace(ACTIONS_EXPORT_PATTERN, (match) => match.replace('export const actions', 'const __userActions'))
					.concat('\n\nexport const actions = __withEdgesActions(__userActions);');
			}

			return wrapped;
		};

		const wrapUniversalRouteModule = (sourceCode: string) => {
			if (!LOAD_EXPORT_PATTERN.test(sourceCode)) return null;
			let wrapped = ensureSyncImport(sourceCode);
			wrapped = wrapped
				.replace(LOAD_EXPORT_PATTERN, (match) => match.replace('export const load', 'const __userUniversalLoad'))
				.concat('\n\nexport const load = __withEdgesUniversalLoad(__userUniversalLoad);');
			return wrapped;
		};

		return {
			name: `${packageName}-auto-handle`,
			enforce: 'pre',

			transform(code, id) {
				if (syncFromServer && SERVER_ROUTE_PATTERN.test(id) && !id.includes('hooks.server')) {
					const wrapped = wrapServerRouteModule(code);
					if (wrapped) return { code: wrapped, map: null };
				}

				if (syncFromServer && UNIVERSAL_ROUTE_PATTERN.test(id) && !id.includes('.server.')) {
					const wrapped = wrapUniversalRouteModule(code);
					if (wrapped) return { code: wrapped, map: null };
				}

				if (!id.includes('hooks.server.ts')) return null;

				if (code.includes('__EDGES_AUTO_WRAPPED__')) return null;

				if (MANUAL_IMPORT_PATTERN.test(code)) {
					return null;
				}

				const hasHandleExport = HANDLE_EXPORT_PATTERN.test(code);

				const compressionOptions = compression.enabled ? `, { compress: true, compressionThreshold: ${compression.threshold || 1024} }` : '';

				const silentOption = silentChromeDevtools ? '' : `, false`;

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
