import { createState, createDerivedState, createRawState } from '../store/index.js';

type StoreDeps = {
	createRawState: typeof createRawState;
	createState: typeof createState;
	createDerivedState: typeof createDerivedState;
};

interface CreateProviderOptions<T, I extends Record<string, unknown> = Record<string, unknown>> {
	inject?: I;
	factory: (args: StoreDeps & I) => T;
}

export const createProvider = <T, I extends Record<string, unknown> = Record<string, unknown>>(options: CreateProviderOptions<T, I>): (() => T) => {
	const deps = {
		...{
			createState,
			createRawState,
			createDerivedState
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
