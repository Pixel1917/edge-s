import {
	createState as BaseCreateState,
	createDerivedState as BaseCreateDerivedState,
	createRawState as BaseCreateRawState
} from '../store/index.js';
import { RequestContext } from '../context/index.js';
import { browser } from '$app/environment';
import type { Writable } from 'svelte/store';

type NoConflict<I, D> = {
	[K in keyof I]: K extends keyof D ? never : I[K];
};

type UnknownFunc = (...args: unknown[]) => unknown;

// Global client cache
const globalClientCache = new Map<string, unknown>();

// Key auto-generate
class AutoKeyGenerator {
	private static cache = new WeakMap<UnknownFunc, string>();
	private static counters = new Map<string, number>();

	static generate(factory: UnknownFunc): string {
		if (this.cache.has(factory)) {
			return this.cache.get(factory)!;
		}

		const fnString = factory.toString();

		let hash = 0;
		for (let i = 0; i < fnString.length; i++) {
			const char = fnString.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}

		const baseKey = `store_${Math.abs(hash).toString(36)}`;

		let finalKey = baseKey;
		if (this.counters.has(baseKey)) {
			const count = this.counters.get(baseKey)! + 1;
			this.counters.set(baseKey, count);
			finalKey = `${baseKey}_${count}`;
		} else {
			this.counters.set(baseKey, 0);
		}
		this.cache.set(factory, finalKey);

		return finalKey;
	}
}

export const clearCache = (pattern?: string) => {
	if (browser) {
		if (pattern) {
			for (const [key] of globalClientCache) {
				if (key.includes(pattern)) {
					globalClientCache.delete(key);
				}
			}
		} else {
			globalClientCache.clear();
		}
	}
};

const createUiProvider = <
	T,
	F,
	D extends Record<string, unknown> | ((cacheKey: string) => Record<string, unknown>),
	I extends Record<string, unknown> = Record<string, unknown>
>(
	cacheKey: string,
	factory: (deps: F) => T,
	dependencies: D,
	inject?: I
): (() => T) => {
	return (): T => {
		let contextMap: Map<string, unknown>;

		if (browser) {
			contextMap = globalClientCache;
		} else {
			try {
				const context = RequestContext.current();
				if (!context.data.providers) {
					context.data.providers = new Map();
				}
				contextMap = context.data.providers;
			} catch {
				contextMap = new Map();
			}
		}

		if (contextMap.has(cacheKey)) {
			const cached = contextMap.get(cacheKey);
			if (cached !== undefined) {
				return cached as T;
			}
		}

		const deps = {
			...(typeof dependencies === 'function' ? dependencies(cacheKey) : dependencies),
			...inject
		} as F;

		const instance = factory(deps);

		contextMap.set(cacheKey, instance);

		return instance;
	};
};

type StoreDeps = {
	createRawState: <T>(initial: T | (() => T)) => { value: T };
	createState: <T>(initial: T | (() => T)) => Writable<T>;
	createDerivedState: typeof BaseCreateDerivedState;
};

/**
 * Creates store without name needed
 * @example
 * export const useUserStore = createStore(({ createState }) => {
 *   const user = createState(null);
 *   return { user };
 * });
 */
export function createStore<T, I extends Record<string, unknown> = Record<string, unknown>>(
	factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T,
	inject?: I
): () => T {
	const cacheKey = AutoKeyGenerator.generate(factory as UnknownFunc);

	return createUiProvider(
		cacheKey,
		factory,
		(key: string) => {
			let stateCounter = 0;

			return {
				createState: <R>(initial: R | (() => R)) => {
					const stateKey = `${key}::state::${stateCounter++}`;
					const initFn = typeof initial === 'function' ? (initial as () => R) : () => initial;
					return BaseCreateState<R>(stateKey, initFn);
				},
				createRawState: <RS>(initial: RS | (() => RS)) => {
					const stateKey = `${key}::rawstate::${stateCounter++}`;
					const initFn = typeof initial === 'function' ? (initial as () => RS) : () => initial;
					return BaseCreateRawState<RS>(stateKey, initFn);
				},
				createDerivedState: BaseCreateDerivedState
			};
		},
		inject
	);
}

// Creates store with nmame
export function createNamedStore<T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T,
	inject?: I
): () => T {
	return createUiProvider(
		name,
		factory,
		(cacheKey: string) => {
			let stateCounter = 0;

			return {
				createState: <R>(initial: R | (() => R)) => {
					const key = `${cacheKey}::state::${stateCounter++}`;
					const initFn = typeof initial === 'function' ? (initial as () => R) : () => initial;
					return BaseCreateState<R>(key, initFn);
				},
				createRawState: <RS>(initial: RS | (() => RS)) => {
					const key = `${cacheKey}::rawstate::${stateCounter++}`;
					const initFn = typeof initial === 'function' ? (initial as () => RS) : () => initial;
					return BaseCreateRawState<RS>(key, initFn);
				},
				createDerivedState: BaseCreateDerivedState
			};
		},
		inject
	);
}

/**
 * Store factory
 */
export const createStoreFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function <T>(factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T): () => T {
		return createStore(factory, inject);
	};
};

/**
 * Presenter without name needed
 */
export function createPresenter<T, I extends Record<string, unknown> = Record<string, unknown>>(factory: (args: I) => T, inject?: I): () => T {
	const cacheKey = AutoKeyGenerator.generate(factory as UnknownFunc);
	return createUiProvider(cacheKey, factory, {}, inject);
}

/**
 * Named presenter
 */
export function createNamedPresenter<T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: I) => T,
	inject?: I
): () => T {
	return createUiProvider(name, factory, {}, inject);
}

/**
 * Presenter factory
 */
export const createPresenterFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function <T>(factory: (args: I) => T): () => T {
		return createPresenter(factory, inject);
	};
};
