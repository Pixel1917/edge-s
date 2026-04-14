import { browser } from '../utils/environment.js';

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
	const EDGES_STATE_FIELD = '__edges_state__';
	const EDGES_REV_FIELD = '__edges_rev__';
	let lastAppliedRevision = 0;

	const applyEdgesFromPayload = (payload: unknown) => {
		if (!payload || typeof payload !== 'object') return;
		const data = payload as Record<string, unknown>;
		const rawState = data[EDGES_STATE_FIELD];
		if (!rawState || typeof rawState !== 'object') return;

		const revision = Number(data[EDGES_REV_FIELD] ?? 0);
		if (Number.isFinite(revision) && revision > 0) {
			if (revision <= lastAppliedRevision) return;
			lastAppliedRevision = revision;
		}

		processEdgesState(rawState as Record<string, unknown>);
	};

	void import('$app/state')
		.then(({ page }) => {
			const apply = () => {
				applyEdgesFromPayload(page.data);
				applyEdgesFromPayload(page.form);
			};

			apply();
			const timer = window.setInterval(apply, 50);
			window.addEventListener(
				'beforeunload',
				() => {
					window.clearInterval(timer);
				},
				{ once: true }
			);
		})
		.catch(() => {
			// app state unavailable in this environment
		});

	if (typeof MutationObserver !== 'undefined') {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node instanceof HTMLScriptElement) {
							const text = node.textContent || '';
							if (text.includes('__SAFE_SSR_STATE__') && text.includes('__EDGES_REVIVER__')) {
								queueMicrotask(() => {
									if (window.__SAFE_SSR_STATE__) {
										for (const [key, value] of window.__SAFE_SSR_STATE__) {
											const callback = stateUpdateCallbacks.get(key);
											if (callback) {
												callback(value);
											}
										}
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
