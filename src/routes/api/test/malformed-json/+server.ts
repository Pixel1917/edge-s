import { type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return new Response('{ "invalid": json syntax here }', {
		status: 200,
		headers: {
			'content-type': 'application/json'
		}
	});
};
