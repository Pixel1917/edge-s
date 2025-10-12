import { createStoreFactory } from '$lib/provider/index.js';

const createInjected = createStoreFactory({
	log: () => {
		console.log('Im injected');
		return 'lol';
	}
});

export const injectedTestProvider = createInjected(({ createRawState, log }) => {
	const someState = createRawState(55);

	const update = () => {
		console.log('test injection');
		someState.value = 90;
		log();
	};

	return { someState, update };
});
