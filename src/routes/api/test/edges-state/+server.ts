import { json, type RequestHandler } from '@sveltejs/kit';

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
