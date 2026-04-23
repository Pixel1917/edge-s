import {
	createState as BaseCreateState,
	createDerivedState as BaseCreateDerivedState,
	createRawState as BaseCreateRawState
} from '../store/index.js';
import { BROWSER } from '@azure-net/tools/environment';
import { RequestContext } from '../context/index.js';
import type { Writable } from 'svelte/store';
import { recordProviderAccess, registerProviderDefinition } from './Utils.js';

type NoConflict<I, D> = {
	[K in keyof I]: K extends keyof D ? never : I[K];
};

type UnknownFunc = { (...args: unknown[]): unknown; __storeKey__: string; displayName: string };

const globalClientCache = new Map<string, unknown>();
const globalConstructionStack: string[] = [];
const PROVIDER_FACTORY_MARK = Symbol.for('edges-svelte.provider.factory');
const PROVIDER_INSTANCE_MARK = Symbol.for('edges-svelte.provider.instance');

type MarkedProvider = {
	[PROVIDER_FACTORY_MARK]?: string;
};

type MarkedInstance = {
	[PROVIDER_INSTANCE_MARK]?: string;
};

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

		if (BROWSER) {
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
	if (BROWSER) {
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
	const readConstructionStack = (): string[] => {
		if (BROWSER) return globalConstructionStack;
		try {
			const context = RequestContext.current();
			return (context.data.providersConstructionStack ??= []);
		} catch {
			return globalConstructionStack;
		}
	};

	const markProviderInstance = (instance: unknown) => {
		if (!instance) return;
		if (typeof instance !== 'object' && typeof instance !== 'function') return;
		try {
			Object.defineProperty(instance as object, PROVIDER_INSTANCE_MARK, {
				value: cacheKey,
				enumerable: false,
				configurable: false,
				writable: false
			});
		} catch {
			/* do nothing */
		}
	};

	const provider = (() => {
		let contextMap: Map<string, unknown>;
		if (BROWSER) {
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
				recordProviderAccess(cacheKey, cached, BROWSER ? contextMap.size : undefined);
				return cached as T;
			}
		}

		const deps = {
			...(typeof dependencies === 'function' ? dependencies(cacheKey) : dependencies),
			...inject
		} as F;

		const constructionStack = readConstructionStack();
		if (constructionStack.includes(cacheKey)) {
			return contextMap.get(cacheKey) as T;
		}
		constructionStack.push(cacheKey);

		let instance: T;
		try {
			instance = factory(deps);
		} finally {
			const idx = constructionStack.lastIndexOf(cacheKey);
			if (idx !== -1) constructionStack.splice(idx, 1);
		}
		markProviderInstance(instance);

		contextMap.set(cacheKey, instance);
		recordProviderAccess(cacheKey, instance, BROWSER ? contextMap.size : undefined);

		return instance;
	}) as (() => T) & MarkedProvider;

	try {
		Object.defineProperty(provider, PROVIDER_FACTORY_MARK, {
			value: cacheKey,
			enumerable: false,
			configurable: false,
			writable: false
		});
	} catch {
		/* do nothing */
	}

	return provider;
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
	registerProviderDefinition(cacheKey, 'store', factory as UnknownFunc, Boolean(name));

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
	registerProviderDefinition(cacheKey, 'presenter', factory as UnknownFunc, Boolean(name));

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
