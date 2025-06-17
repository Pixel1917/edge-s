import {
	createState as BaseCreateState,
	createDerivedState as BaseCreateDerivedState,
	createRawState as BaseCreateRawState
} from '../store/index.js';
import { RequestContext } from '../context/index.js';
import { browser } from '$app/environment';
import type { Writable } from 'svelte/store';

type StoreDeps = {
	createRawState: <T>(initial: T | (() => T)) => { value: T };
	createState: <T>(initial: T | (() => T)) => Writable<T>;
	createDerivedState: typeof BaseCreateDerivedState;
};

type NoConflict<I> = {
	[K in keyof I]: K extends keyof StoreDeps ? never : I[K];
};

const globalClientCache = new Map<string, unknown>();

export const createProvider = <T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: StoreDeps & NoConflict<I>) => T,
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
			return contextMap.get(cacheKey) as T;
		}

		let stateCounter = 0;

		const autoKeyDeps = {
			...inject,
			createState: <R>(initial: R | (() => R)) => {
				const key = `${cacheKey ?? 'provider'}::state::${stateCounter++}`;
				const initFn = typeof initial === 'function' ? (initial as () => R) : () => initial;
				return BaseCreateState<R>(key, initFn);
			},
			createRawState: <RS>(initial: RS | (() => RS)) => {
				const key = `${cacheKey ?? 'provider'}::rawstate::${stateCounter++}`;
				const initFn = typeof initial === 'function' ? (initial as () => RS) : () => initial;
				return BaseCreateRawState<RS>(key, initFn);
			},
			createDerivedState: BaseCreateDerivedState
		} as StoreDeps & NoConflict<I>;

		const instance = factory(autoKeyDeps);
		if (cacheKey) {
			contextMap.set(cacheKey, instance);
		}
		return instance;
	};
};

export const createProviderFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function createInjectedProvider<T>(name: string, factory: (args: StoreDeps & NoConflict<I>) => T): () => T {
		return createProvider(name, factory, inject);
	};
};
