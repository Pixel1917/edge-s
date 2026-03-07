import { json, type RequestHandler } from '@sveltejs/kit';

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
