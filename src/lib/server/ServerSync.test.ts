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
		expect(payload.__edges_rev__).toBeTruthy();
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
