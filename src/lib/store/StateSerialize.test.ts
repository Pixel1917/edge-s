import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { edgesHandle } from '../server/EdgesHandle.js';
import { createRawState } from './State.svelte.js';

class MockCookies {
	get(): string | undefined {
		return undefined;
	}
	set(): void {}
}

const makeEvent = (pathname: string): RequestEvent => {
	const url = new URL(`http://localhost${pathname}`);
	return {
		url,
		request: new Request(url),
		cookies: new MockCookies()
	} as unknown as RequestEvent;
};

describe('stateSerialize', () => {
	it('serializes bigint without crashing SSR output', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async ({ serialize }) => {
			const state = createRawState('bigint-key', () => 0n);
			state.value = 12345678901234567890n;
			return new Response(serialize('<html><body>ok</body></html>'), {
				headers: { 'content-type': 'text/html' }
			});
		});

		const html = await response.text();
		expect(html).toContain('__EDGES_BIGINT__');
		expect(html).toContain('12345678901234567890');
	});

	it('escapes script-breakout sequences in serialized values', async () => {
		const event = makeEvent('/sync-tests/no-layout');

		const response = await edgesHandle(event, async ({ serialize }) => {
			const state = createRawState('script-key', () => '');
			state.value = `</script><script>alert('xss')</script>`;
			return new Response(serialize('<html><body>ok</body></html>'), {
				headers: { 'content-type': 'text/html' }
			});
		});

		const html = await response.text();
		expect(html).toContain('\\u003C/script\\u003E\\u003Cscript\\u003Ealert');
		expect(html).not.toContain("</script><script>alert('xss')</script>");
	});
});
