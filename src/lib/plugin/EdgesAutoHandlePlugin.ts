import type { Plugin } from 'vite';
import * as ts from 'typescript';

export interface EdgesPluginOptions {
	silentChromeDevtools?: boolean;
	syncFromServer?: boolean;
	syncTransformMode?: 'ast' | 'regex' | 'hybrid';
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
	const MANUAL_IMPORT_PATTERN = new RegExp(`from\\s+['"](?:${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/server|\\$lib/server)['"]`, 'g');
	const HANDLE_EXPORT_PATTERN = /export\s+const\s+handle\s*(?::\s*\w+\s*)?=/;
	const LOAD_EXPORT_PATTERN = /export\s+const\s+load\s*(?::\s*[^=]+)?=/;
	const ACTIONS_EXPORT_PATTERN = /export\s+const\s+actions\s*(?::\s*[^=]+)?=/;
	const SERVER_ROUTE_PATTERN = /[\\/]\+((page|layout)\.server)\.(t|j)s$/;
	const UNIVERSAL_ROUTE_PATTERN = /[\\/]\+((page|layout))\.(t|j)s$/;
	const SYNC_MARKER = "void '__EDGES_SYNC_WRAPPED__';";
	const AST_SERVER_LOAD_ALIAS = '__edgesWrappedServerLoad';
	const AST_ACTIONS_ALIAS = '__edgesWrappedActions';
	const AST_UNIVERSAL_LOAD_ALIAS = '__edgesWrappedUniversalLoad';

	type Edit = { start: number; end: number; text: string };

	const applyEdits = (sourceCode: string, edits: Edit[]) => {
		if (edits.length === 0) return sourceCode;
		const sorted = edits.sort((a, b) => b.start - a.start);
		let result = sourceCode;
		for (const edit of sorted) {
			result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
		}
		return result;
	};

	return function edgesPlugin(options?: EdgesPluginOptions): Plugin {
		const { silentChromeDevtools = true, syncFromServer = true, syncTransformMode = 'hybrid' } = options || {};

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

		const ensureSyncImport = (sourceCode: string, importLine: string) => {
			if (sourceCode.includes('__EDGES_SYNC_WRAPPED__')) return sourceCode;
			const insertPos = findImportInsertPosition(sourceCode);
			const beforeImports = sourceCode.slice(0, insertPos);
			const afterImports = sourceCode.slice(insertPos);
			return `${beforeImports}\n${SYNC_MARKER}\n${importLine}\n${afterImports}`;
		};

		const ensureAstServerImport = (sourceCode: string) =>
			ensureSyncImport(
				sourceCode,
				`import { __withEdgesServerLoad as ${AST_SERVER_LOAD_ALIAS}, __withEdgesActions as ${AST_ACTIONS_ALIAS} } from '${serverPath}';`
			);

		const ensureAstUniversalImport = (sourceCode: string) =>
			ensureSyncImport(sourceCode, `import { __withEdgesUniversalLoad as ${AST_UNIVERSAL_LOAD_ALIAS} } from '${serverPath}';`);

		const ensureRegexImport = (sourceCode: string) =>
			ensureSyncImport(sourceCode, `import { __withEdgesServerLoad, __withEdgesActions, __withEdgesUniversalLoad } from '${serverPath}';`);

		const findExportedLocal = (sourceFile: ts.SourceFile, code: string, exportedName: 'load' | 'actions') => {
			const edits: Edit[] = [];
			let localName: string | null = null;
			let found = false;

			for (const stmt of sourceFile.statements) {
				if (ts.isVariableStatement(stmt)) {
					const exportModifier = stmt.modifiers?.find((m) => m.kind === ts.SyntaxKind.ExportKeyword);
					if (!exportModifier) continue;

					for (const declaration of stmt.declarationList.declarations) {
						if (!ts.isIdentifier(declaration.name)) continue;
						if (declaration.name.text !== exportedName) continue;
						localName = declaration.name.text;
						found = true;
						const modifierStart = exportModifier.getStart(sourceFile);
						let modifierEnd = exportModifier.end;
						while (modifierEnd < code.length && /\s/.test(code[modifierEnd])) modifierEnd += 1;
						edits.push({ start: modifierStart, end: modifierEnd, text: '' });
						break;
					}
				}

				if (!ts.isExportDeclaration(stmt) || !stmt.exportClause || !ts.isNamedExports(stmt.exportClause) || stmt.moduleSpecifier) continue;

				const named = stmt.exportClause;
				const keepSpecs: string[] = [];
				let statementHasTarget = false;

				for (const el of named.elements) {
					const exportName = el.name.text;
					const sourceName = el.propertyName?.text ?? el.name.text;
					if (exportName === exportedName) {
						statementHasTarget = true;
						found = true;
						localName = sourceName;
						continue;
					}
					keepSpecs.push(code.slice(el.getStart(sourceFile), el.end).trim());
				}

				if (!statementHasTarget) continue;
				if (keepSpecs.length === 0) {
					edits.push({ start: stmt.getStart(sourceFile), end: stmt.end, text: '' });
				} else {
					edits.push({ start: stmt.getStart(sourceFile), end: stmt.end, text: `export { ${keepSpecs.join(', ')} };` });
				}
			}

			return { localName, edits, found };
		};

		const wrapServerRouteModuleRegex = (sourceCode: string) => {
			if (!LOAD_EXPORT_PATTERN.test(sourceCode) && !ACTIONS_EXPORT_PATTERN.test(sourceCode)) {
				return null;
			}
			let wrapped = ensureRegexImport(sourceCode);

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

		const wrapUniversalRouteModuleRegex = (sourceCode: string) => {
			if (!LOAD_EXPORT_PATTERN.test(sourceCode)) return null;
			let wrapped = ensureRegexImport(sourceCode);
			wrapped = wrapped
				.replace(LOAD_EXPORT_PATTERN, (match) => match.replace('export const load', 'const __userUniversalLoad'))
				.concat('\n\nexport const load = __withEdgesUniversalLoad(__userUniversalLoad);');
			return wrapped;
		};

		const wrapServerRouteModuleAst = (sourceCode: string) => {
			if (sourceCode.includes('__EDGES_SYNC_WRAPPED__')) return null;
			let sourceFile: ts.SourceFile;
			try {
				sourceFile = ts.createSourceFile('route.ts', sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
			} catch {
				return null;
			}

			const loadInfo = findExportedLocal(sourceFile, sourceCode, 'load');
			const actionsInfo = findExportedLocal(sourceFile, sourceCode, 'actions');
			if (!loadInfo.found && !actionsInfo.found) return null;
			if ((loadInfo.found && !loadInfo.localName) || (actionsInfo.found && !actionsInfo.localName)) return null;

			let nextCode = applyEdits(sourceCode, [...loadInfo.edits, ...actionsInfo.edits]);
			nextCode = ensureAstServerImport(nextCode);

			const append: string[] = [];
			if (loadInfo.localName) {
				append.push(`const __edgesServerLoad = ${AST_SERVER_LOAD_ALIAS}(${loadInfo.localName});`);
				append.push(`export { __edgesServerLoad as load };`);
			}
			if (actionsInfo.localName) {
				append.push(`const __edgesServerActions = ${AST_ACTIONS_ALIAS}(${actionsInfo.localName});`);
				append.push(`export { __edgesServerActions as actions };`);
			}
			return `${nextCode}\n\n${append.join('\n')}`;
		};

		const wrapUniversalRouteModuleAst = (sourceCode: string) => {
			if (sourceCode.includes('__EDGES_SYNC_WRAPPED__')) return null;
			let sourceFile: ts.SourceFile;
			try {
				sourceFile = ts.createSourceFile('route.ts', sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
			} catch {
				return null;
			}

			const loadInfo = findExportedLocal(sourceFile, sourceCode, 'load');
			if (!loadInfo.found || !loadInfo.localName) return null;

			let nextCode = applyEdits(sourceCode, [...loadInfo.edits]);
			nextCode = ensureAstUniversalImport(nextCode);

			return `${nextCode}\n\nconst __edgesUniversalLoad = ${AST_UNIVERSAL_LOAD_ALIAS}(${loadInfo.localName});\nexport { __edgesUniversalLoad as load };`;
		};

		return {
			name: `${packageName}-auto-handle`,
			enforce: 'pre',

			transform(code, id) {
				if (syncFromServer && SERVER_ROUTE_PATTERN.test(id) && !id.includes('hooks.server')) {
					const wrapped =
						syncTransformMode === 'regex'
							? wrapServerRouteModuleRegex(code)
							: syncTransformMode === 'ast'
								? wrapServerRouteModuleAst(code)
								: (wrapServerRouteModuleAst(code) ?? wrapServerRouteModuleRegex(code));
					if (wrapped) return { code: wrapped, map: null };
				}

				if (syncFromServer && UNIVERSAL_ROUTE_PATTERN.test(id) && !id.includes('.server.')) {
					const wrapped =
						syncTransformMode === 'regex'
							? wrapUniversalRouteModuleRegex(code)
							: syncTransformMode === 'ast'
								? wrapUniversalRouteModuleAst(code)
								: (wrapUniversalRouteModuleAst(code) ?? wrapUniversalRouteModuleRegex(code));
					if (wrapped) return { code: wrapped, map: null };
				}

				if (!id.includes('hooks.server.ts')) return null;

				if (code.includes('__EDGES_AUTO_WRAPPED__')) return null;

				if (MANUAL_IMPORT_PATTERN.test(code)) {
					return null;
				}

				const hasHandleExport = HANDLE_EXPORT_PATTERN.test(code);

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
							`resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) })${silentOption});`,
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
					`const __silentChromeDevtools = ${silentChromeDevtools};\n` +
					`export const handle = __autoWrapHandle(__userHandle, __silentChromeDevtools);`;

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
