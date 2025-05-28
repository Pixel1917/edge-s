import { browser } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';

export interface ContextData {
	event?: RequestEvent;
	symbol?: symbol;
	data: {
		providers?: Map<string, unknown>;
		[p: string]: unknown;
	};
}

export default {
	current(): ContextData {
		if (!browser) {
			throw new Error('AsyncLocalStorage has not been initialized');
		}
		return { data: {} };
	}
};
