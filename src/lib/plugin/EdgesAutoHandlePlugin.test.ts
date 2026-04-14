import { describe, expect, it } from 'vitest';
import { createEdgesPluginFactory } from './EdgesAutoHandlePlugin.js';

const pluginFactory = createEdgesPluginFactory('edges-svelte', 'edges-svelte/server');

const runTransform = (code: string, id: string, options?: Parameters<typeof pluginFactory>[0]) => {
	const plugin = pluginFactory(options);
	const transformHook = plugin.transform;
	if (!transformHook) return null;
	const handler = typeof transformHook === 'function' ? transformHook : transformHook.handler;
	const result = handler.call({} as never, code, id);
	if (!result) return null;
	if (result instanceof Promise) return result;
	return result;
};

describe('EdgesAutoHandlePlugin AST transforms', () => {
	const serverId = '/src/routes/x/+page.server.ts';
	const universalId = '/src/routes/x/+page.ts';

	it('wraps exported server load declaration', () => {
		const source = `export const load = async () => ({ ok: true });`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesServerLoad = __edgesWrappedServerLoad(load);`);
		expect(out?.code).toContain(`export { __edgesServerLoad as load };`);
		expect(out?.code).toContain(`import { __withEdgesServerLoad as __edgesWrappedServerLoad, __withEdgesActions as __edgesWrappedActions }`);
	});

	it('wraps exported actions declaration', () => {
		const source = `export const actions = { save: async () => ({ ok: true }) };`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesServerActions = __edgesWrappedActions(actions);`);
		expect(out?.code).toContain(`export { __edgesServerActions as actions };`);
	});

	it('wraps both load and actions declarations', () => {
		const source = `export const load = async () => ({});\nexport const actions = { save: async () => ({ ok: true }) };`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`__edgesServerLoad`);
		expect(out?.code).toContain(`__edgesServerActions`);
	});

	it('wraps load exported through specifier', () => {
		const source = `const load = async () => ({ ok: true });\nexport { load };`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesServerLoad = __edgesWrappedServerLoad(load);`);
		expect(out?.code).not.toContain(`export { load };`);
	});

	it('wraps actions exported through specifier', () => {
		const source = `const actions = { save: async () => ({ ok: true }) };\nexport { actions };`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesServerActions = __edgesWrappedActions(actions);`);
		expect(out?.code).not.toContain(`export { actions };`);
	});

	it('wraps alias exports for load and actions', () => {
		const source = `const routeLoad = async () => ({ ok: true });\nconst routeActions = { save: async () => ({ ok: true }) };\nexport { routeLoad as load, routeActions as actions };`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesServerLoad = __edgesWrappedServerLoad(routeLoad);`);
		expect(out?.code).toContain(`const __edgesServerActions = __edgesWrappedActions(routeActions);`);
	});

	it('keeps unrelated export specifiers intact', () => {
		const source = `const load = async () => ({ ok: true });\nconst x = 1;\nexport { load, x };`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`export { x };`);
		expect(out?.code).toContain(`__edgesServerLoad`);
	});

	it('supports typed load declarations', () => {
		const source = `import type { PageServerLoad } from './$types';\nexport const load: PageServerLoad = async () => ({ ok: true });`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesServerLoad = __edgesWrappedServerLoad(load);`);
	});

	it('supports satisfies syntax', () => {
		const source = `export const load = (async () => ({ ok: true })) satisfies import('./$types').PageServerLoad;`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesServerLoad = __edgesWrappedServerLoad(load);`);
	});

	it('returns null when no load/actions export exists', () => {
		const source = `export const value = 1;`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' });
		expect(out).toBeNull();
	});

	it('wraps universal load declaration', () => {
		const source = `export const load = async () => ({ ok: true });`;
		const out = runTransform(source, universalId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesUniversalLoad = __edgesWrappedUniversalLoad(load);`);
		expect(out?.code).toContain(`export { __edgesUniversalLoad as load };`);
		expect(out?.code).toContain(`import { __withEdgesUniversalLoad as __edgesWrappedUniversalLoad }`);
	});

	it('wraps universal aliased load export', () => {
		const source = `const routeLoad = async () => ({ ok: true });\nexport { routeLoad as load };`;
		const out = runTransform(source, universalId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`const __edgesUniversalLoad = __edgesWrappedUniversalLoad(routeLoad);`);
	});

	it('does not transform +page.server in universal branch', () => {
		const source = `export const load = async () => ({ ok: true });`;
		const out = runTransform(source, '/src/routes/x/+layout.server.ts', { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`__edgesWrappedServerLoad`);
	});

	it('is idempotent due marker', () => {
		const source = `export const load = async () => ({ ok: true });`;
		const first = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string };
		const second = runTransform(first.code, serverId, { syncTransformMode: 'ast' });
		expect(second).toBeNull();
	});

	it('uses hybrid mode by default', () => {
		const source = `export const load = async () => ({ ok: true });`;
		const out = runTransform(source, serverId) as { code: string } | null;
		expect(out?.code).toContain(`__edgesWrappedServerLoad`);
	});

	it('supports regex-only mode', () => {
		const source = `export const load = async () => ({ ok: true });`;
		const out = runTransform(source, serverId, { syncTransformMode: 'regex' }) as { code: string } | null;
		expect(out?.code).toContain(`export const load = __withEdgesServerLoad(__userLoad);`);
	});

	it('hybrid falls back to regex for unsupported external re-export', () => {
		const source = `export { load } from './x';\nexport const load = async () => ({ ok: true });`;
		const out = runTransform(source, serverId, { syncTransformMode: 'hybrid' }) as { code: string } | null;
		expect(out?.code).toContain(`__withEdgesServerLoad`);
	});

	it('keeps hooks transform working', () => {
		const source = `export const handle = async ({ event, resolve }) => resolve(event);`;
		const out = runTransform(source, '/src/hooks.server.ts', { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`__autoWrapHandle`);
	});

	it('skips hooks transform when already wrapped', () => {
		const source = `// __EDGES_AUTO_WRAPPED__\nexport const handle = async ({ event, resolve }) => resolve(event);`;
		const out = runTransform(source, '/src/hooks.server.ts', { syncTransformMode: 'ast' });
		expect(out).toBeNull();
	});

	it('skips sync wrapping when disabled', () => {
		const source = `export const load = async () => ({ ok: true });`;
		const out = runTransform(source, serverId, { syncFromServer: false, syncTransformMode: 'ast' });
		expect(out).toBeNull();
	});

	it('preserves multiline server declarations', () => {
		const source = `export const load = async ({ params }) => {\n\treturn {\n\t\tid: params.id\n\t};\n};`;
		const out = runTransform(source, serverId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`__edgesWrappedServerLoad(load)`);
	});

	it('preserves multiline universal declarations', () => {
		const source = `export const load = async ({ fetch }) => {\n\tconst res = await fetch('/x');\n\treturn res.json();\n};`;
		const out = runTransform(source, universalId, { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`__edgesWrappedUniversalLoad(load)`);
	});

	it('supports wrapping layout routes as server files', () => {
		const source = `export const actions = { submit: async () => ({ ok: true }) };`;
		const out = runTransform(source, '/src/routes/x/+layout.server.ts', { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`__edgesWrappedActions(actions)`);
	});

	it('supports wrapping layout routes as universal files', () => {
		const source = `const routeLoad = async () => ({ ok: true });\nexport { routeLoad as load };`;
		const out = runTransform(source, '/src/routes/x/+layout.ts', { syncTransformMode: 'ast' }) as { code: string } | null;
		expect(out?.code).toContain(`__edgesWrappedUniversalLoad(routeLoad)`);
	});
});
