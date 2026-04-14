import type { Handle } from '@sveltejs/kit';

export const handle: Handle = ({ resolve, event }) => {
	console.log('handle', event.locals);
	return resolve(event);
};
