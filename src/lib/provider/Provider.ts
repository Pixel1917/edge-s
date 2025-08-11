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

const globalClientCache = new Map<string, unknown>();

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

export const createUiProvider = <
	T,
	F,
	D extends Record<string, unknown> | ((cacheKey: string) => Record<string, unknown>),
	I extends Record<string, unknown> = Record<string, unknown>
>(
	name: string,
	factory: (deps: F) => T,
	dependencies: D,
	inject?: I
): (() => T) => {
	const cacheKey = name;

	return (): T => {
		let contextMap: Map<string, unknown>;
		if (browser) {
			contextMap = globalClientCache;
		} else {
			const context = RequestContext.current();
			if (!context.data.providers) {
				context.data.providers = new Map();
			}
			contextMap = context.data.providers;
		}

		if (cacheKey && contextMap.has(cacheKey)) {
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

		if (cacheKey) {
			contextMap.set(cacheKey, instance);
		}

		return instance;
	};
};

type StoreDeps = {
	createRawState: <T>(initial: T | (() => T)) => { value: T };
	createState: <T>(initial: T | (() => T)) => Writable<T>;
	createDerivedState: typeof BaseCreateDerivedState;
};

export const createStore = <T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T,
	inject?: I
): (() => T) => {
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
};

export const createStoreFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function createInjectedStore<T>(name: string, factory: (args: StoreDeps & NoConflict<I, StoreDeps>) => T): () => T {
		return createStore(name, factory, inject);
	};
};

export const createPresenter = <T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: I) => T,
	inject?: I
): (() => T) => {
	return createUiProvider(name, factory, {}, inject);
};

export const createPresenterFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function createInjectedStore<T>(name: string, factory: (args: I) => T): () => T {
		return createPresenter(name, factory, inject);
	};
};
