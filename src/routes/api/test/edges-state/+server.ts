import { json, type RequestHandler } from '@sveltejs/kit';

/**
 * Test endpoint that returns JSON with edges state
 * This simulates a typical SvelteKit API endpoint with edges state management
 */
export const GET: RequestHandler = async () => {
	return json({
		message: 'Success with edges state',
		timestamp: new Date().toISOString(),
		data: {
			id: 1,
			name: 'Test Item'
		}
	});
};
