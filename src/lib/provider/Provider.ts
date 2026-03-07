import {
	createState as BaseCreateState,
	createDerivedState as BaseCreateDerivedState,
	createRawState as BaseCreateRawState
} from '../store/index.js';
import { RequestContext } from '../context/index.js';
import { browser } from '../utils/environment.js';
import { DevTools } from '../utils/dev.js';
import type { Writable } from 'svelte/store';

type NoConflict<I, D> = {
	[K in keyof I]: K extends keyof D ? never : I[K];
};

type UnknownFunc = { (...args: unknown[]): unknown; __storeKey__: string; displayName: string };

const globalClientCache = new Map<string, unknown>();

class AutoKeyGenerator {
	private static cache = new WeakMap<UnknownFunc, string>();
	private static counters = new Map<string, number>();

	static generate(factory: UnknownFunc): string {
		let cache: WeakMap<UnknownFunc, string>;
		let counters: Map<string, number>;

		const setGlobalCacheSystem = () => {
			cache = this.cache;
			counters = this.counters;
		};

		if (browser) {
			setGlobalCacheSystem();
		} else {
			try {
				const context = RequestContext.current();
				cache = context.data.providersAutoKeyCache ??= new WeakMap<UnknownFunc, string>();
				counters = context.data.providersAutoKeyCounters ??= new Map<string, number>();
			} catch {
				setGlobalCacheSystem();
			}
		}

		if (cache!.has(factory)) return cache!.get(factory)!;

		const fnIdentifier = factory.__storeKey__ || factory.displayName || factory.name || factory.toString();

		const hash = this.hash(fnIdentifier);
		const baseKey = `store_${Math.abs(hash).toString(36)}`;

		let finalKey = baseKey;
		if (counters!.has(baseKey)) {
			const count = counters!.get(baseKey)! + 1;
			counters!.set(baseKey, count);
			finalKey = `${baseKey}_${count}`;
		} else {
			counters!.set(baseKey, 0);
		}
		cache!.set(factory, finalKey);

		DevTools.validateFactoryUniqueness(factory, finalKey);

		return finalKey;
	}

	private static hash(str: string): number {
		let hash = 2166136261;
		for (let i = 0; i < str.length; i++) {
			hash = (hash ^ str.charCodeAt(i)) * 16777619;
			hash = hash >>> 0;
		}
		return hash;
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

export function createStore<T, I extends Record<string, unknown> = Record<string, unknown>>(
	factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T,
	inject?: I
): () => T;
export function createStore<T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T,
	inject?: I
): () => T;
export function createStore<T, I extends Record<string, unknown> = Record<string, unknown>>(
	nameOrFactory: string | ((args: StoreDeps & NoConflict<I, StoreDeps>) => T),
	factoryOrInject?: ((args: StoreDeps & NoConflict<I, StoreDeps>) => T) | I,
	inject?: I
): () => T {
	const isNameProvided = typeof nameOrFactory === 'string';
	const name = isNameProvided ? nameOrFactory : undefined;
	const factory = isNameProvided ? (factoryOrInject as (args: StoreDeps & NoConflict<I, StoreDeps>) => T) : nameOrFactory;
	const injections = isNameProvided ? inject : (factoryOrInject as I);

	const cacheKey = name || AutoKeyGenerator.generate(factory as UnknownFunc);

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
		injections
	);
}

export const createStoreFactory = <I extends Record<string, unknown>>(inject: I) => {
	function storeFactory<T>(factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T): () => T;
	function storeFactory<T>(name: string, factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T): () => T;
	function storeFactory<T>(
		nameOrFactory: string | ((args: StoreDeps & NoConflict<I, StoreDeps>) => T),
		factory?: (args: StoreDeps & NoConflict<I, StoreDeps>) => T
	): () => T {
		if (typeof nameOrFactory === 'string') {
			return createStore(nameOrFactory, factory!, inject);
		} else {
			return createStore(nameOrFactory, inject);
		}
	}

	return storeFactory;
};

export function createPresenter<T, I extends Record<string, unknown> = Record<string, unknown>>(factory: (args: I) => T, inject?: I): () => T;
export function createPresenter<T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: I) => T,
	inject?: I
): () => T;
export function createPresenter<T, I extends Record<string, unknown> = Record<string, unknown>>(
	nameOrFactory: string | ((args: I) => T),
	factoryOrInject?: ((args: I) => T) | I,
	inject?: I
): () => T {
	const isNameProvided = typeof nameOrFactory === 'string';
	const name = isNameProvided ? nameOrFactory : undefined;
	const factory = isNameProvided ? (factoryOrInject as (args: I) => T) : nameOrFactory;
	const injections = isNameProvided ? inject : (factoryOrInject as I);

	const cacheKey = name || AutoKeyGenerator.generate(factory as UnknownFunc);

	return createUiProvider(cacheKey, factory, {}, injections);
}

export const createPresenterFactory = <I extends Record<string, unknown>>(inject: I) => {
	function presenterFactory<T>(factory: (args: I) => T): () => T;
	function presenterFactory<T>(name: string, factory: (args: I) => T): () => T;
	function presenterFactory<T>(nameOrFactory: string | ((args: I) => T), factory?: (args: I) => T): () => T {
		if (typeof nameOrFactory === 'string') {
			return createPresenter(nameOrFactory, factory!, inject);
		} else {
			return createPresenter(nameOrFactory, inject);
		}
	}

	return presenterFactory;
};
