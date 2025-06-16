import { createProviderFactory } from '$lib/provider/index.js';

const createInjected = createProviderFactory({
	log: () => {
		console.log('Im injected');
	}
});

export const injectedTestProvider = createInjected('factoryProvider', ({ createRawState, log }) => {
	const someState = createRawState(55);

	const update = () => {
		console.log('test injection');
		someState.value = 90;
		log();
	};

	return { someState, update };
});
