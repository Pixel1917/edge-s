import { createState, createDerivedState, createRawState } from '../store/index.js';
import { RequestContext } from '../context/index.js';
import { browser } from '$app/environment';

type StoreDeps = {
	createRawState: typeof createRawState;
	createState: typeof createState;
	createDerivedState: typeof createDerivedState;
};

interface CreateProviderOptions<T, I extends Record<string, unknown> = Record<string, unknown>> {
	inject?: I;
	cacheKey?: string;
	factory: (args: StoreDeps & I) => T;
}

const globalClientCache = new Map<string, unknown>();

export const createProvider = <T, I extends Record<string, unknown> = Record<string, unknown>>(options: CreateProviderOptions<T, I>): (() => T) => {
	const deps = {
		...{
			createState,
			createRawState,
			createDerivedState
		},
		...(options.inject || {})
	} as StoreDeps & I;
	const cacheKey = options.cacheKey;
	return () => {
		if (!cacheKey) {
			return options.factory(deps);
		}

		if (browser) {
			if (!globalClientCache.has(cacheKey)) {
				globalClientCache.set(cacheKey, options.factory(deps));
			}
			return globalClientCache.get(cacheKey) as T;
		} else {
			const context = RequestContext.current();
			if (!context.data.providers) {
				context.data.providers = new Map<string, unknown>();
			}
			const map = context.data.providers as Map<string, unknown>;
			if (!map.has(cacheKey)) {
				map.set(cacheKey, options.factory(deps));
			}
			return map.get(cacheKey) as T;
		}
	};
};

export const createProviderFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function createInjectedProvider<T>(options: CreateProviderOptions<T, I>): () => T {
		return createProvider({
			...options,
			inject
		});
	};
};
