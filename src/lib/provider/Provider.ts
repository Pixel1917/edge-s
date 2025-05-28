import { createState, createStoreState, createDerivedStore } from '../store/index.js';

type StoreDeps = {
	createState: typeof createState;
	createStoreState: typeof createStoreState;
	createDerivedStore: typeof createDerivedStore;
};

interface CreateProviderOptions<T, I extends Record<string, unknown> = Record<string, unknown>> {
	inject?: I;
	factory: (args: StoreDeps & I) => T;
}

export const createProvider = <T, I extends Record<string, unknown> = Record<string, unknown>>(options: CreateProviderOptions<T, I>): (() => T) => {
	const deps = {
		...{
			createState,
			createStoreState,
			createDerivedStore
		},
		...(options.inject || {})
	} as StoreDeps & I;

	return () => options.factory(deps);
};

export const createProviderFactory = <I extends Record<string, unknown>>(inject: I) => {
	return function createInjectedProvider<T>(options: CreateProviderOptions<T, I>): () => T {
		return createProvider({
			...options,
			inject
		});
	};
};
