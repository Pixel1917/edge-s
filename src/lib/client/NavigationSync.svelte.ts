import { browser } from '$app/environment';

const stateUpdateCallbacks = new Map<string, (value: unknown) => void>();

const UNDEFINED_MARKER = '__EDGES_UNDEFINED__';
const NULL_MARKER = '__EDGES_NULL__';

const safeReviver = (key: string, value: unknown): unknown => {
	if (value && typeof value === 'object') {
		if (UNDEFINED_MARKER in value) {
			return undefined;
		}
		if (NULL_MARKER in value) {
			return null;
		}
	}
	return value;
};

export function registerStateUpdate(key: string, callback: (value: unknown) => void) {
	if (browser) {
		stateUpdateCallbacks.set(key, callback);
	}
}

export function unregisterStateUpdate(key: string) {
	stateUpdateCallbacks.delete(key);
}

export function processEdgesState(edgesState: Record<string, unknown>) {
	if (!window.__SAFE_SSR_STATE__) {
		window.__SAFE_SSR_STATE__ = new Map();
	}

	for (const [key, value] of Object.entries(edgesState)) {
		let processedValue = value;
		if (typeof value === 'string') {
			try {
				processedValue = JSON.parse(value, safeReviver);
			} catch {
				// If not JSON then use without handling
			}
		}

		window.__SAFE_SSR_STATE__.set(key, processedValue);

		const callback = stateUpdateCallbacks.get(key);
		if (callback) {
			callback(processedValue);
		}
	}
}

if (browser) {
	const originalFetch = window.fetch;

	const parseHeaders = (headers?: Headers | HeadersInit) => {
		const parsedHeaders: Record<string, string> = {};
		switch (true) {
			case headers instanceof Headers:
				headers.forEach((value, key) => {
					parsedHeaders[key] = value;
				});
				return parsedHeaders;
			case headers && typeof headers === 'object':
				Object.entries(headers).forEach(([key, value]) => {
					parsedHeaders[key] = value;
				});
				return parsedHeaders;
			default:
				return parsedHeaders;
		}
	};

	window.fetch = async function (...args) {
		const [input, init] = args;
		let reqInfo: { url: string; headers: Record<string, string> } = { url: '', headers: {} };

		if (typeof input === 'string') {
			reqInfo = { url: input, headers: parseHeaders(init?.headers) };
		} else if (input instanceof Request) {
			reqInfo = { url: input.url, headers: parseHeaders(input.headers) };
		} else if (input instanceof URL) {
			reqInfo = { url: input.href, headers: parseHeaders(init?.headers) };
		}

		const isSvelteKitRequest =
			(init as Record<string, unknown>).__sveltekit_fetch__ || reqInfo.headers['x-sveltekit-action'] || reqInfo.url.includes('__data.json');

		const response = await originalFetch.apply(this, args);

		if (!isSvelteKitRequest) {
			return response;
		}

		if (!response.headers.get('content-type')?.includes('application/json')) {
			return response;
		}

		const interceptEdgesStateFromResponse = (response: Response): Response => {
			if (!response.body) return response;
			if (init?.method === 'POST') {
				const originalText = response.text.bind(response);

				response.text = async function () {
					const text = await originalText();
					if (text.includes('__edges_state__')) {
						try {
							const parsed = JSON.parse(text);
							if (parsed.__edges_state__) {
								processEdgesState(parsed.__edges_state__);
							}
						} catch {
							// ignore parsing errors
						}
					}
					return text;
				};
			}
			const originalGetReader = response.body.getReader.bind(response.body);

			response.body.getReader = function <D extends ArrayBufferView<ArrayBufferLike>, T extends ReadableStreamDefaultReader<D>>(
				opts?: ReadableStreamGetReaderOptions
			) {
				const reader = originalGetReader(opts) as T;

				if (!('read' in reader)) return reader;

				const originalRead = reader.read.bind(reader);
				const decoder = new TextDecoder();

				let buffer = '';
				let found = false;
				let depth = 0;
				let capture = '';

				reader.read = async function () {
					const result = await originalRead();
					if (result.done || found) return result;

					buffer += decoder.decode(result.value, { stream: true });

					const idx = buffer.indexOf('"__edges_state__"');
					if (idx !== -1) {
						const braceStart = buffer.indexOf('{', idx);
						if (braceStart !== -1) {
							for (let i = braceStart; i < buffer.length; i++) {
								const ch = buffer[i];
								if (ch === '{') {
									if (depth++ === 0) capture = '';
								}
								if (depth > 0) capture += ch;
								if (ch === '}') {
									depth--;
									if (depth === 0) {
										try {
											const parsed = JSON.parse(capture);
											processEdgesState(parsed);
											found = true;
										} catch {
											// waiting for next iteration
										}
										break;
									}
								}
							}
						}
						const MAX_BUFFER = Math.max(8192, capture.length * 2);
						if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER / 2);
					}

					return result;
				};
				return reader;
			};

			return response;
		};

		return interceptEdgesStateFromResponse(response);
	};

	if (typeof MutationObserver !== 'undefined') {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node instanceof HTMLScriptElement) {
							const text = node.textContent || '';
							if (text.includes('__SAFE_SSR_STATE__') && text.includes('__EDGES_REVIVER__')) {
								setTimeout(() => {
									if (window.__SAFE_SSR_STATE__) {
										for (const [key, value] of window.__SAFE_SSR_STATE__) {
											const callback = stateUpdateCallbacks.get(key);
											if (callback) {
												callback(value);
											}
										}
									}
								}, 0);
							}
						}
					}
				}
			}
		});

		observer.observe(document.documentElement, {
			childList: true,
			subtree: true
		});
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', () => observer.disconnect());
			window.addEventListener('pagehide', () => observer.disconnect());
		}
	}
}
