import { stateSerialize, getStateMap } from '../store/State.svelte.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import RequestContext, { type ContextData } from '../context/Context.js';
import type { RequestEvent } from '@sveltejs/kit';

const storage = new AsyncLocalStorage<ContextData>();
const textEncoder = new TextEncoder();

// Маркеры для специальных значений
const UNDEFINED_MARKER = '__EDGES_UNDEFINED__';
const NULL_MARKER = '__EDGES_NULL__';

// Безопасный replacer для JSON
const safeReplacer = (key: string, value: unknown): unknown => {
	if (value === undefined) {
		return { [UNDEFINED_MARKER]: true };
	}
	if (value === null) {
		return { [NULL_MARKER]: true };
	}
	return value;
};

type EdgesHandle = (
	event: RequestEvent,
	callback: (params: { edgesEvent: RequestEvent; serialize: (html: string) => string }) => Promise<Response> | Response,
	silentChromeDevtools?: boolean
) => Promise<Response>;

/**
 * Wraps request handling in an AsyncLocalStorage context
 */
export const edgesHandle: EdgesHandle = async (event, callback, silentChromeDevtools = false) => {
	const requestSymbol = Symbol('request');

	return await storage.run(
		{
			event: event,
			symbol: requestSymbol,
			data: { providers: new Map() }
		},
		async () => {
			// Настраиваем RequestContext
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

			// Chrome DevTools handling
			if (silentChromeDevtools && event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
				return new Response(null, { status: 204 });
			}

			// Выполняем основной callback
			const response = await callback({
				edgesEvent: event,
				serialize: (html: string) => {
					if (!html) return html ?? '';

					// Вставляем сериализованное состояние перед </body>
					const serialized = stateSerialize();
					if (!serialized) return html;

					return html.replace('</body>', `${serialized}</body>`);
				}
			});

			// Проверяем, нужно ли инжектить состояние в JSON
			const contentType = response.headers.get('content-type');

			if (contentType?.includes('application/json')) {
				const stateMap = getStateMap();

				// Если есть состояние для передачи
				if (stateMap && stateMap.size > 0) {
					try {
						// Клонируем response для чтения
						const clonedResponse = response.clone();
						const json = await clonedResponse.json();

						// Подготавливаем состояние для передачи
						const stateObj: Record<string, string> = {};

						for (const [key, value] of stateMap) {
							// Сериализуем каждое значение отдельно с поддержкой undefined
							stateObj[key] = JSON.stringify(value, safeReplacer);
						}

						// Добавляем состояние в JSON
						const modifiedJson = {
							...json,
							__edges_state__: stateObj
						};

						const modifiedBody = JSON.stringify(modifiedJson);

						// Создаем новые заголовки с правильной длиной
						const newHeaders = new Headers(response.headers);
						newHeaders.set('content-length', String(textEncoder.encode(modifiedBody).length));

						return new Response(modifiedBody, {
							status: response.status,
							statusText: response.statusText,
							headers: newHeaders
						});
					} catch (e) {
						console.error('[edges] Failed to inject state into JSON response:', e);
						// При ошибке возвращаем оригинальный response
						return response;
					}
				}
			}

			return response;
		}
	);
};
