import type { Handle } from '@sveltejs/kit';

export const handle: Handle = ({ resolve, event }) => {
	console.log('im in handle');
	return resolve(event);
};
