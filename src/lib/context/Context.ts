import { browser } from '../utils/environment.js';
import type { RequestEvent } from '@sveltejs/kit';

export interface ContextData {
	event?: RequestEvent;
	symbol?: symbol;
	data: {
		message?: string;
		providers?: Map<string, unknown>;
		providersAutoKeyCache?: WeakMap<(...args: unknown[]) => unknown, string>;
		providersAutoKeyCounters?: Map<string, number>;
	} & App.ContextDataExtended;
}

class RequestContextManager {
	private _currentGetter?: () => ContextData;

	init(getter: () => ContextData) {
		this._currentGetter = getter;
	}

	current(): ContextData {
		if (browser) {
			return { data: { message: 'Do not use request context on client side' } };
		}
		if (!this._currentGetter) {
			throw new Error('[edges] RequestContext not initialized. Did you forget to add edgesPlugin()?');
		}
		return this._currentGetter();
	}
}

export const RequestContext = new RequestContextManager();
