import RequestContext from '../context/Context.js';
import { uneval } from 'devalue';
import { browser } from '$app/environment';
import { derived, type Readable, type Writable, writable } from 'svelte/store';

const RequestStores: WeakMap<symbol, Map<string, unknown>> = new WeakMap();

declare global {
	interface Window {
		__SAFE_SSR_STATE__?: Map<string, unknown>;
	}
}

export const stateSerialize = (): string => {
	const map = getRequestContext();
	if (map) {
		const entries = Array.from(map).map(([key, value]) => [uneval(key), uneval(value)]);

		return `<script>
			window.__SAFE_SSR_STATE__ = new Map();
			${entries.map(([key, value]) => `window.__SAFE_SSR_STATE__.set(${key}, ${value})`).join(';')}
			</script>`;
	}
	return '';
};

const getRequestContext = () => {
	const sym = RequestContext.current().symbol;
	if (sym) {
		return RequestStores.get(sym) ?? RequestStores.set(sym, new Map()).get(sym)!;
	}
};

const getBrowserState = <T>(key: string, initial: T) => {
	const state = window.__SAFE_SSR_STATE__?.get(key);
	if (state) return state as T;

	return initial;
};

export const createRawState = <T>(key: string, initial: () => T): { value: T } => {
	if (browser) {
		let state = $state(getBrowserState(key, initial()));
		return {
			get value() {
				return state;
			},
			set value(val: T) {
				state = val;
			}
		};
	}

	const map = getRequestContext();
	return {
		get value() {
			if (!map) return initial();
			if (!map.has(key)) map.set(key, structuredClone(initial()));
			return map.get(key) as T;
		},
		set value(val: T) {
			if (map) {
				map.set(key, val);
			}
		}
	};
};

export const createState = <T>(key: string, initial: () => T): Writable<T> => {
	if (browser) {
		return writable<T>(getBrowserState(key, initial()));
	}

	const map = getRequestContext();
	if (!map) throw new Error('No RequestContext available');

	if (!map.has(key)) map.set(key, structuredClone(initial()));

	//const subscribers: Set<(val: T) => void> = new Set();

	return {
		subscribe(run) {
			run(map.get(key) as T);
			//subscribers.add(run);
			return () => {};
		},
		set(val: T) {
			map.set(key, val);
			//subscribers.forEach((fn) => fn(val));
		},
		update(updater) {
			const oldVal = map.get(key) as T;
			const newVal = updater(oldVal);
			map.set(key, newVal);
			//subscribers.forEach((fn) => fn(newVal));
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
			const values: T[] = new Array(stores.length);
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
					values[i] = value as T;
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
