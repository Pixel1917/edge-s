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
	let processingResponse = false;

	window.fetch = async function (...args) {
		const response = await originalFetch.apply(this, args);

		if (processingResponse) {
			return response;
		}

		const [input, init] = args;
		const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
		const isSvelteKitGet = (init as Record<string, unknown>).__sveltekit_fetch__ || url.includes('__data.json');
		const isSvelteKitPost = input instanceof URL && input.search.startsWith('?/');
		if (isSvelteKitGet || isSvelteKitPost) {
			const contentType = response.headers.get('content-type');

			if (contentType?.includes('application/json')) {
				processingResponse = true;

				try {
					const cloned = response.clone();
					const text = await cloned.text();

					if (text) {
						try {
							const json = JSON.parse(text);
							if (json && typeof json === 'object' && '__edges_state__' in json) {
								processEdgesState(json.__edges_state__ as Record<string, unknown>);
							}
						} catch {
							// ignore no JSON or parse Errors
						}
					}
				} catch {
					// Ошибка клонирования или чтения - игнорируем
				} finally {
					processingResponse = false;
				}
			}
		}

		return response;
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
	}
}
