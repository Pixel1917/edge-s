import { edgesHandle } from '$lib/server/index.js';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	return edgesHandle(
		event,
		({ serialize, edgesEvent }) => {
			return resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) });
		},
		true
	);
};
