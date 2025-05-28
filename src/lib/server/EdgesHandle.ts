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
	return await storage.run({ event: event, symbol: Symbol(), data: { providers: new Map() } }, async () => {
		RequestContext.current = () => {
			const context = storage.getStore();
			if (context === undefined) {
				throw new Error(
					'[Edge-S] State access attempted outside of a valid request context.\n' +
						'\nThis usually happens if you are calling a provider or using `createState`/`createDerivedState` at the module (top) level.\n' +
						'\n✅ Correct usage:\n' +
						'  - Inside a `load` function (page.server.ts / page.ts)\n' +
						'  - Inside Svelte components (in <script>)\n' +
						'  - Inside `handle` hook or other request-scoped logic\n' +
						'\n🚫 Incorrect usage:\n' +
						'  - Calling providers or states directly at the top level of a module (e.g., outside any function or component)\n' +
						'\nTo fix this, wrap your provider or state call inside a function, component, or request handler.\n'
				);
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
