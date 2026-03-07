import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return new Response('Plain text response', {
		status: 200,
		headers: {
			'content-type': 'text/plain'
		}
	});
};
