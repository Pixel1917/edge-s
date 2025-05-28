import { stateSerialize } from '../store/State.svelte.js';
import { AsyncLocalStorage } from 'async_hooks';
import RequestContext, { type ContextData } from '../context/Context.js';
import type { RequestEvent } from '@sveltejs/kit';

const storage = new AsyncLocalStorage<ContextData>();

type EdgesHandle = (
	event: RequestEvent,
	callback: (params: { edgesEvent: RequestEvent; serialize: (html: string) => string }) => Promise<Response> | Response,
	silentChromeDevtools?: boolean
) => Promise<Response>;

/**
 * Wraps request handling in an AsyncLocalStorage context and provides a `serialize` function
 * for injecting state into the HTML response.
 *
 * @param event - The SvelteKit RequestEvent for the current request.
 * @param callback - A function that receives the event and a serialize function,
 *   and returns a Response or a Promise of one.
 * @param silentChromeDevtools - If true, intercepts requests to
 *   `/.well-known/appspecific/com.chrome.devtools.json` (triggered by Chrome DevTools)
 *   and returns a 204 No Content response instead of a 404 error.
 */
export const edgesHandle: EdgesHandle = async (event, callback, silentChromeDevtools = false) => {
	return await storage.run({ event: event, symbol: Symbol() }, async () => {
		RequestContext.current = () => {
			const context = storage.getStore();
			if (context === undefined) {
				throw new Error('Request symbol has not been initialized');
			}
			return context;
		};
		if (silentChromeDevtools && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
			return new Response(null, { status: 204 });
		}
		return callback({
			edgesEvent: event,
			serialize: (html: string) => {
				if (!html) return html ?? '';
				return html.replace('</body>', `${stateSerialize()}</body>`);
			}
		});
	});
};
