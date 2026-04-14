import { createStore } from '$lib/provider/index.js';

export const syncTestProvider = createStore('SyncTestProvider', ({ createRawState }) => {
	const scenario = createRawState('idle');
	const layoutCounter = createRawState(0);
	const pageCounter = createRawState(0);
	const actionCounter = createRawState(0);
	const actionPayload = createRawState<string | undefined>(undefined);

	return {
		scenario,
		layoutCounter,
		pageCounter,
		actionCounter,
		actionPayload
	};
});
