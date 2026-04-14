import { stateSerialize } from '../store/State.svelte.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestContext, type ContextData } from '../context/Context.js';
import type { RequestEvent } from '@sveltejs/kit';

const storage = new AsyncLocalStorage<ContextData>();
let requestRevision = 0;

type SerializeOptions = {
	compress?: boolean;
	compressionThreshold?: number;
};

type EdgesHandle = (
	event: RequestEvent,
	callback: (params: { edgesEvent: RequestEvent; serialize: (html: string, options?: SerializeOptions) => string }) => Promise<Response> | Response,
	silentChromeDevtools?: boolean
) => Promise<Response>;

export const edgesHandle: EdgesHandle = async (event, callback, silentChromeDevtools = false) => {
	const requestSymbol = Symbol('request');

	return await storage.run(
		{
			event: event,
			symbol: requestSymbol,
			data: { providers: new Map(), edgesDirtyKeys: new Set(), edgesRevision: ++requestRevision }
		},
		async () => {
			RequestContext.init(() => {
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
			});

			if (silentChromeDevtools && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
				return new Response(null, { status: 204 });
			}

			const response = await callback({
				edgesEvent: event,
				serialize: (html: string, options?: SerializeOptions) => {
					if (!html) return html ?? '';

					const serialized = stateSerialize({
						compress: options?.compress,
						threshold: options?.compressionThreshold
					});
					if (!serialized) return html;

					return html.replace('</body>', `${serialized}</body>`);
				}
			});
			return response;
		}
	);
};
