import { createState, createDerivedState, createRawState } from '../store/index.js';
import { RequestContext } from '../context/index.js';
import { browser } from '$app/environment';
import type { Writable } from 'svelte/store';

type StoreDeps = {
	createRawState: <T>(initial: T | (() => T)) => { value: T };
	createState: <T>(initial: T | (() => T)) => Writable<T>;
	createDerivedState: typeof createDerivedState;
};

const globalClientCache = new Map<string, unknown>();

export const createProvider = <T, I extends Record<string, unknown> = Record<string, unknown>>(
	name: string,
	factory: (args: StoreDeps & I) => T,
	inject?: I
): (() => T) => {
	const cacheKey = name;

	return () => {
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
			createState: <T>(initial: T | (() => T)) => {
				const key = `${cacheKey ?? 'provider'}::state::${stateCounter++}`;
				const initFn = typeof initial === 'function' ? (initial as () => T) : () => initial;
				return createState(key, initFn);
			},
			createRawState: <T>(initial: T | (() => T)) => {
				const key = `${cacheKey ?? 'provider'}::rawstate::${stateCounter++}`;
				const initFn = typeof initial === 'function' ? (initial as () => T) : () => initial;
				return createRawState(key, initFn);
			},
			createDerivedState
		} as StoreDeps & I;

		const instance = factory(autoKeyDeps);
		if (cacheKey) {
			contextMap.set(cacheKey, instance);
		}
		return instance;
	};
};

export const createProviderFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function createInjectedProvider<T>(name: string, factory: (args: StoreDeps & I) => T): () => T {
		return createProvider(name, factory, inject);
	};
};
