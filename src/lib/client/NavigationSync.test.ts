import { beforeEach, describe, expect, it } from 'vitest';
import { applyEdgesFromPayload, processEdgesState } from './NavigationSync.svelte.js';

describe('NavigationSync string decoding', () => {
	beforeEach(() => {
		globalThis.window = {
			__SAFE_SSR_STATE__: new Map<string, unknown>()
		} as Window & typeof globalThis;
	});

	it('keeps plain and json-looking strings as strings', () => {
		processEdgesState({
			plain: '42',
			jsonLike: '{"a":1}'
		});

		expect(window.__SAFE_SSR_STATE__?.get('plain')).toBe('42');
		expect(window.__SAFE_SSR_STATE__?.get('jsonLike')).toBe('{"a":1}');
	});

	it('decodes legacy string payloads with edges markers only', () => {
		processEdgesState({
			bigintLegacy: '{"__EDGES_BIGINT__":"99"}',
			nullLegacy: '{"__EDGES_NULL__":true}'
		});

		expect(window.__SAFE_SSR_STATE__?.get('bigintLegacy')).toBe(99n);
		expect(window.__SAFE_SSR_STATE__?.get('nullLegacy')).toBeNull();
	});
});

describe('NavigationSync revision dedupe', () => {
	beforeEach(() => {
		globalThis.window = {
			__SAFE_SSR_STATE__: new Map<string, unknown>()
		} as Window & typeof globalThis;
	});

	it('skips duplicate payloads with the same revision id', () => {
		applyEdgesFromPayload({
			__edges_state__: { key: 'first' },
			__edges_rev__: 'rev-1'
		});
		applyEdgesFromPayload({
			__edges_state__: { key: 'second' },
			__edges_rev__: 'rev-1'
		});

		expect(window.__SAFE_SSR_STATE__?.get('key')).toBe('first');
	});

	it('applies payload when revision id is different', () => {
		applyEdgesFromPayload({
			__edges_state__: { key: 'first' },
			__edges_rev__: 'rev-2'
		});
		applyEdgesFromPayload({
			__edges_state__: { key: 'second' },
			__edges_rev__: 'rev-3'
		});

		expect(window.__SAFE_SSR_STATE__?.get('key')).toBe('second');
	});
});
