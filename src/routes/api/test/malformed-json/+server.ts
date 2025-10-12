import { type RequestHandler } from '@sveltejs/kit';

/**
 * Test endpoint that returns malformed JSON
 * This tests error handling in the fetch interceptor
 */
export const GET: RequestHandler = async () => {
	return new Response('{ "invalid": json syntax here }', {
		status: 200,
		headers: {
			'content-type': 'application/json'
		}
	});
};
