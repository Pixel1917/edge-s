import { RequestContext } from '../context/Context.js';
import { browser } from '../utils/environment.js';
import { derived, type Readable, type Writable, writable } from 'svelte/store';
import { registerStateUpdate } from '../client/NavigationSync.svelte.js';
import { queueUpdate, isBatching } from '../utils/batch.js';

const RequestStores: WeakMap<symbol, Map<string, unknown>> = new WeakMap();

const UNDEFINED_MARKER = '__EDGES_UNDEFINED__';
const NULL_MARKER = '__EDGES_NULL__';

const REVIVER_CODE = `window.__EDGES_REVIVER__=function(k,v){if(v&&typeof v==='object'){if('${UNDEFINED_MARKER}' in v)return undefined;if('${NULL_MARKER}' in v)return null}return v};`;

declare global {
	interface Window {
		__SAFE_SSR_STATE__?: Map<string, unknown>;
		__EDGES_DEVTOOLS__: Record<string, unknown>;
	}
}

const safeReplacer = (key: string, value: unknown): unknown => {
	if (value === undefined) {
		return { [UNDEFINED_MARKER]: true };
	}
	if (value === null) {
		return { [NULL_MARKER]: true };
	}
	if (typeof value === 'function' || typeof value === 'symbol') {
		return undefined;
	}
	return value;
};

export const stateSerialize = (): string => {
	const map = getRequestContext();
	if (!map || map.size === 0) return '';

	const entries: string[] = [];

	for (const [key, value] of map) {
		const serialized = JSON.stringify(value, safeReplacer);
		const escaped = serialized.replace(/[\\']/g, (ch) => '\\' + ch);
		entries.push(`window.__SAFE_SSR_STATE__.set('${key}',JSON.parse('${escaped}',window.__EDGES_REVIVER__))`);
	}

	return `<script>${REVIVER_CODE}window.__SAFE_SSR_STATE__=new Map();${entries.join(';')}</script>`;
};

const getRequestContext = () => {
	const context = RequestContext.current();
	const sym = context.symbol;
	if (sym) {
		if (!RequestStores.has(sym)) {
			RequestStores.set(sym, new Map());
		}
		return RequestStores.get(sym)!;
	}
};

const markStateDirty = (key: string) => {
	if (browser) return;
	try {
		const context = RequestContext.current();
		(context.data.edgesDirtyKeys ??= new Set()).add(key);
	} catch {
		// no request context, ignore
	}
};

export const getStateMap = (): Map<string, unknown> | undefined => {
	try {
		return getRequestContext();
	} catch {
		return undefined;
	}
};

const getBrowserState = <T>(key: string, initial: T): T => {
	if (!window.__SAFE_SSR_STATE__) {
		return initial;
	}

	const state = window.__SAFE_SSR_STATE__.get(key);

	if (window.__SAFE_SSR_STATE__.has(key)) {
		return state as T;
	}

	return initial;
};

export const createRawState = <T>(key: string, initial: () => T): { value: T } => {
	if (browser) {
		let state = $state(getBrowserState(key, initial()));

		const updateWindowState = (val: T) => {
			if (!window.__SAFE_SSR_STATE__) {
				window.__SAFE_SSR_STATE__ = new Map();
			}
			window.__SAFE_SSR_STATE__.set(key, val);
		};

		const applyValue = (val: T) => {
			state = val;
			updateWindowState(val);
		};

		const callback = (newValue: unknown) => {
			queueUpdate(key, newValue, (next) => applyValue(next as T));
		};

		registerStateUpdate(key, callback);

		return {
			get value() {
				return state;
			},
			set value(val: T) {
				if (isBatching()) {
					queueUpdate(key, val, (next) => applyValue(next as T));
					return;
				}
				applyValue(val);
			}
		};
	}

	const map = getRequestContext();
	if (!map) {
		const val = initial();
		return {
			get value() {
				return val;
			},
			set value(_: T) {}
		};
	}

	return {
		get value() {
			if (!map.has(key)) {
				map.set(key, initial());
			}
			return map.get(key) as T;
		},
		set value(val: T) {
			map.set(key, val);
			markStateDirty(key);
		}
	};
};

export const createState = <T>(key: string, initial: () => T): Writable<T> => {
	if (browser) {
		const initialValue = getBrowserState(key, initial());
		const state = writable<T>(initialValue);
		let currentValue = initialValue;

		const callback = (newValue: unknown) => {
			queueUpdate(key, newValue, (next) => {
				applyValue(next as T);
			});
		};

		registerStateUpdate(key, callback);

		const originalSet = state.set;
		const originalUpdate = state.update;

		const applyValue = (value: T) => {
			currentValue = value;
			originalSet(value);
			if (!window.__SAFE_SSR_STATE__) {
				window.__SAFE_SSR_STATE__ = new Map();
			}
			window.__SAFE_SSR_STATE__.set(key, value);
		};

		state.set = (value: T) => {
			if (isBatching()) {
				currentValue = value;
				queueUpdate(key, value, (next) => {
					applyValue(next as T);
				});
				return;
			}
			applyValue(value);
		};

		state.update = (updater: (value: T) => T) => {
			if (isBatching()) {
				const nextValue = updater(currentValue);
				currentValue = nextValue;
				queueUpdate(key, nextValue, (next) => {
					applyValue(next as T);
				});
				return;
			}
			originalUpdate((current) => {
				const newValue = updater(current);
				currentValue = newValue;
				if (!window.__SAFE_SSR_STATE__) {
					window.__SAFE_SSR_STATE__ = new Map();
				}
				window.__SAFE_SSR_STATE__.set(key, newValue);
				return newValue;
			});
		};

		return state;
	}

	const map = getRequestContext();
	if (!map) {
		const val = initial();
		return {
			subscribe(run) {
				run(val);
				return () => {};
			},
			set() {},
			update() {}
		};
	}

	if (!map.has(key)) {
		map.set(key, initial());
	}

	return {
		subscribe(run) {
			run(map.get(key) as T);
			return () => {};
		},
		set(val: T) {
			map.set(key, val);
			markStateDirty(key);
		},
		update(updater) {
			const oldVal = map.get(key) as T;
			const newVal = updater(oldVal);
			map.set(key, newVal);
			markStateDirty(key);
		}
	};
};

type Stores = [Readable<unknown>, ...Array<Readable<unknown>>] | Array<Readable<unknown>>;
type StoresValues<T> = T extends Readable<infer U> ? U : { [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

export const createDerivedState = <T extends Stores, D>(stores: T, deriveFn: (values: StoresValues<T>) => D): Readable<D> => {
	if (browser) {
		return derived(stores, deriveFn);
	}

	return {
		subscribe(run) {
			const values: unknown[] = new Array(stores.length);
			let initializedCount = 0;
			let isInitialized = false;

			const checkAndRun = () => {
				if (initializedCount >= stores.length && !isInitialized) {
					isInitialized = true;
					run(deriveFn(values as StoresValues<T>));
				}
			};

			const unsubscribers = stores.map((store, i) =>
				store.subscribe((value) => {
					values[i] = value;
					if (initializedCount < stores.length) {
						initializedCount++;
					}
					checkAndRun();
				})
			);

			return () => {
				unsubscribers.forEach((unsub) => unsub());
			};
		}
	};
};
