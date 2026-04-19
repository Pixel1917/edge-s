import { BROWSER } from '@azure-net/tools/environment';
import { batch } from '../utils/batch.js';

const stateUpdateCallbacks = new Map<string, (value: unknown) => void>();

const UNDEFINED_MARKER = '__EDGES_UNDEFINED__';
const NULL_MARKER = '__EDGES_NULL__';
const BIGINT_MARKER = '__EDGES_BIGINT__';
const EDGES_STATE_FIELD = '__edges_state__';
const EDGES_REV_FIELD = '__edges_rev__';
const SEEN_REVISIONS_LIMIT = 200;
const seenRevisions = new Set<string>();

const decodeEdgesValue = (value: unknown): unknown => {
	if (value && typeof value === 'object') {
		if (UNDEFINED_MARKER in value) return undefined;
		if (NULL_MARKER in value) return null;
		if (BIGINT_MARKER in value) return BigInt(String((value as Record<string, unknown>)[BIGINT_MARKER]));
		if (Array.isArray(value)) {
			return value.map((item) => decodeEdgesValue(item));
		}
		const decoded: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
			decoded[key] = decodeEdgesValue(nested);
		}
		return decoded;
	}
	return value;
};

const tryDecodeLegacyString = (value: string): unknown => {
	const trimmed = value.trim();
	if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
		return value;
	}
	if (!trimmed.includes(UNDEFINED_MARKER) && !trimmed.includes(NULL_MARKER) && !trimmed.includes(BIGINT_MARKER)) {
		return value;
	}

	try {
		return decodeEdgesValue(JSON.parse(trimmed));
	} catch {
		return value;
	}
};

export function registerStateUpdate(key: string, callback: (value: unknown) => void) {
	if (BROWSER) {
		stateUpdateCallbacks.set(key, callback);
	}
}

export function unregisterStateUpdate(key: string) {
	stateUpdateCallbacks.delete(key);
}

export function processEdgesState(edgesState: Record<string, unknown>) {
	const store = window.__SAFE_SSR_STATE__ ?? new Map<string, unknown>();
	window.__SAFE_SSR_STATE__ = store;

	batch(() => {
		for (const [key, value] of Object.entries(edgesState)) {
			const processedValue = typeof value === 'string' ? tryDecodeLegacyString(value) : decodeEdgesValue(value);

			store.set(key, processedValue);

			const callback = stateUpdateCallbacks.get(key);
			if (callback) {
				callback(processedValue);
			}
		}
	});
}

export function applyEdgesFromPayload(payload: unknown) {
	if (!payload || typeof payload !== 'object') return;
	const data = payload as Record<string, unknown>;
	const rawState = data[EDGES_STATE_FIELD];
	if (!rawState || typeof rawState !== 'object') return;

	const revision = data[EDGES_REV_FIELD];
	if (typeof revision === 'string' && revision.length > 0) {
		if (seenRevisions.has(revision)) return;
		seenRevisions.add(revision);
		if (seenRevisions.size > SEEN_REVISIONS_LIMIT) {
			const oldestRevision = seenRevisions.values().next().value;
			if (oldestRevision) {
				seenRevisions.delete(oldestRevision);
			}
		}
	}

	processEdgesState(rawState as Record<string, unknown>);
}

declare global {
	interface Window {
		__EDGES_NAVIGATION_SYNC_MOUNTED__?: boolean;
	}
}

if (BROWSER) {
	if (!window.__EDGES_NAVIGATION_SYNC_MOUNTED__) {
		window.__EDGES_NAVIGATION_SYNC_MOUNTED__ = true;
		void Promise.all([import('svelte'), import('./NavigationStateObserver.svelte')])
			.then(([svelte, module]) => {
				const target = document.body || document.documentElement;
				const host = document.createElement('div');
				host.setAttribute('data-edges-navigation-sync', '1');
				host.style.display = 'none';
				target.appendChild(host);
				svelte.mount(module.default, { target: host });
				window.addEventListener(
					'beforeunload',
					() => {
						host.remove();
						window.__EDGES_NAVIGATION_SYNC_MOUNTED__ = false;
					},
					{ once: true }
				);
			})
			.catch(() => {
				window.__EDGES_NAVIGATION_SYNC_MOUNTED__ = false;
			});
	}

	if (typeof MutationObserver !== 'undefined') {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node instanceof HTMLScriptElement) {
							const text = node.textContent || '';
							if (text.includes('__SAFE_SSR_STATE__') && text.includes('__EDGES_REVIVER__')) {
								queueMicrotask(() => {
									const store = window.__SAFE_SSR_STATE__;
									if (store) {
										batch(() => {
											for (const [key, value] of store) {
												const callback = stateUpdateCallbacks.get(key);
												if (callback) {
													callback(value);
												}
											}
										});
									}
								});
							}
						}
					}
				}
			}
		});

		observer.observe(document.body || document.documentElement, {
			childList: true,
			subtree: false
		});

		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', () => observer.disconnect());
			window.addEventListener('pagehide', () => observer.disconnect());
		}
	}
}
