import { browser } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';

export interface ContextData {
	event?: RequestEvent;
	symbol?: symbol;
	data: {
		providers?: Map<string, unknown>;
		boundary?: Map<string, unknown>;
	} & App.ContextDataExtended;
}

export default {
	current(): ContextData {
		if (!browser) {
			throw new Error('[edges] AsyncLocalStorage not initialized');
		}
		return { data: {} };
	}
};
