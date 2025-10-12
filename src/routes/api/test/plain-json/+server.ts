import { json, type RequestHandler } from '@sveltejs/kit';

/**
 * Test endpoint that returns plain JSON without any edges state
 * This simulates a simple API that shouldn't be affected by edges interceptor
 */
export const GET: RequestHandler = async () => {
	return json({
		message: 'Plain JSON response',
		timestamp: new Date().toISOString(),
		data: {
			items: [1, 2, 3, 4, 5],
			count: 5
		}
	});
};
