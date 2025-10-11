import { browser } from '$app/environment';

const stateUpdateCallbacks = new Map<string, (value: unknown) => void>();

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
		window.__SAFE_SSR_STATE__.set(key, value);

		const callback = stateUpdateCallbacks.get(key);
		if (callback) {
			callback(value);
		}
	}
}

if (browser) {
	const originalFetch = window.fetch;

	window.fetch = async function (...args) {
		const response = await originalFetch.apply(this, args);

		const clonedResponse = response.clone();
		try {
			const contentType = clonedResponse.headers.get('content-type');
			if (contentType?.includes('application/json')) {
				const json = await clonedResponse.json();

				if (json && typeof json === 'object' && '__edges_state__' in json) {
					const edgesState = json.__edges_state__ as Record<string, unknown>;
					processEdgesState(edgesState);
				}
			}
		} catch {
			// Ignore JSON parsing errors
		}

		return response;
	};
}
