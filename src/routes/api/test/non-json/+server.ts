import type { RequestHandler } from '@sveltejs/kit';

/**
 * Test endpoint that returns non-JSON content
 * This tests that the interceptor doesn't break non-JSON responses
 */
export const GET: RequestHandler = async () => {
	return new Response('Plain text response', {
		status: 200,
		headers: {
			'content-type': 'text/plain'
		}
	});
};
