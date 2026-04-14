import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { edgesHandle } from './EdgesHandle.js';
import { __withEdgesActions, __withEdgesServerLoad, __withEdgesUniversalLoad } from './ServerSync.js';
import { createRawState } from '../store/State.svelte.js';

class MockCookies {
	get(): string | undefined {
		return undefined;
	}
	set(): void {}
}

const makeEvent = (pathname: string, method = 'GET', headers?: HeadersInit): RequestEvent => {
	const url = new URL(`http://localhost${pathname}`);
	return {
		url,
		request: new Request(url, { method, headers }),
		cookies: new MockCookies()
	} as unknown as RequestEvent;
};

describe('ServerSync wrappers', () => {
	it('does not inject delta when state is only read', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async () => {
			const wrappedLoad = __withEdgesServerLoad(async () => {
				const state = createRawState('sync-read-only-key', () => null as string | null);
				void state.value;
				return { base: true };
			});

			const data = await wrappedLoad();
			return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as Record<string, unknown>;
		expect(payload.base).toBe(true);
		expect(payload.__edges_state__).toBeUndefined();
		expect(payload.__edges_rev__).toBeUndefined();
	});

	it('injects delta into wrapped server load result', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async () => {
			const wrappedLoad = __withEdgesServerLoad(async () => {
				const state = createRawState('sync-load-key', () => 'init');
				state.value = 'from-load';
				return { base: true };
			});

			const data = await wrappedLoad();
			return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as Record<string, unknown>;
		expect(payload.base).toBe(true);
		expect(payload.__edges_state__).toBeTruthy();
		expect((payload.__edges_state__ as Record<string, unknown>)['sync-load-key']).toBe('from-load');
		expect(payload.__edges_rev__).toBeTruthy();
	});

	it('injects delta into wrapped action result', async () => {
		const event = makeEvent('/sync-tests/with-layout/level-one/level-two', 'POST', {
			'x-sveltekit-action': 'true'
		});

		const response = await edgesHandle(event, async () => {
			const wrappedActions = __withEdgesActions({
				submit: async () => {
					const state = createRawState('sync-action-key', () => 0);
					state.value = 10;
					return { ok: true };
				}
			});

			const data = await wrappedActions.submit();
			return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as Record<string, unknown>;
		expect(payload.ok).toBe(true);
		expect(payload.__edges_state__).toBeTruthy();
		expect((payload.__edges_state__ as Record<string, unknown>)['sync-action-key']).toBe(10);
		expect(payload.__edges_rev__).toBeTruthy();
	});

	it('injects delta when wrapped load returns undefined', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async () => {
			const wrappedLoad = __withEdgesServerLoad(async () => {
				const state = createRawState('sync-undefined-load-key', () => 1);
				state.value = 2;
				return undefined;
			});

			const data = await wrappedLoad();
			return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as Record<string, unknown>;
		expect((payload.__edges_state__ as Record<string, unknown>)['sync-undefined-load-key']).toBe(2);
		expect(payload.__edges_rev__).toBeTruthy();
	});

	it('does not modify non-object payloads from wrapped load', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async () => {
			const wrappedLoad = __withEdgesServerLoad(async () => {
				const state = createRawState('sync-non-object-key', () => 0);
				state.value = 1;
				return 'plain-text-payload';
			});

			const data = await wrappedLoad();
			return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as { data: unknown };
		expect(payload.data).toBe('plain-text-payload');
	});

	it('encodes undefined values in raw delta object', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async () => {
			const wrappedLoad = __withEdgesServerLoad(async () => {
				const state = createRawState<{ maybe?: string } | undefined>('sync-undefined-key', () => ({ maybe: 'x' }));
				state.value = undefined;
				return { ok: true };
			});

			const data = await wrappedLoad();
			return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as Record<string, unknown>;
		const edgesState = payload.__edges_state__ as Record<string, unknown>;
		expect((edgesState['sync-undefined-key'] as Record<string, unknown>).__EDGES_UNDEFINED__).toBe(true);
	});

	it('encodes nested undefined and null values in raw delta object', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async () => {
			const wrappedLoad = __withEdgesServerLoad(async () => {
				const state = createRawState<Record<string, unknown>>('sync-nested-key', () => ({ ok: true }));
				state.value = {
					a: undefined,
					b: null,
					c: { d: undefined, e: null },
					f: [1, undefined, null]
				};
				return { ok: true };
			});

			const data = await wrappedLoad();
			return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as Record<string, unknown>;
		const encoded = (payload.__edges_state__ as Record<string, unknown>)['sync-nested-key'] as Record<string, unknown>;
		expect((encoded.a as Record<string, unknown>).__EDGES_UNDEFINED__).toBe(true);
		expect((encoded.b as Record<string, unknown>).__EDGES_NULL__).toBe(true);
		expect(((encoded.c as Record<string, unknown>).d as Record<string, unknown>).__EDGES_UNDEFINED__).toBe(true);
		expect(((encoded.c as Record<string, unknown>).e as Record<string, unknown>).__EDGES_NULL__).toBe(true);
		const encodedArray = encoded.f as unknown[];
		expect((encodedArray[1] as Record<string, unknown>).__EDGES_UNDEFINED__).toBe(true);
		expect((encodedArray[2] as Record<string, unknown>).__EDGES_NULL__).toBe(true);
	});

	it('encodes bigint values in raw delta object', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async () => {
			const wrappedLoad = __withEdgesServerLoad(async () => {
				const state = createRawState<bigint>('sync-bigint-key', () => 1n);
				state.value = 999999999999999999n;
				return { ok: true };
			});

			const data = await wrappedLoad();
			return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
		});

		const payload = (await response.json()) as Record<string, unknown>;
		const encoded = (payload.__edges_state__ as Record<string, unknown>)['sync-bigint-key'] as Record<string, unknown>;
		expect(encoded.__EDGES_BIGINT__).toBe('999999999999999999');
	});

	it('passes edges data through wrapped universal load', async () => {
		const wrapped = __withEdgesUniversalLoad(async (res: unknown) => {
			return {
				merged: true,
				title: String((res as { data: Record<string, unknown> }).data.title)
			};
		});

		const result = (await wrapped({
			data: {
				title: 'hello',
				__edges_state__: { x: '1' },
				__edges_rev__: 5
			}
		})) as Record<string, unknown>;

		expect(result.merged).toBe(true);
		expect(result.__edges_state__).toEqual({ x: '1' });
		expect(result.__edges_rev__).toBe(5);
	});
});
