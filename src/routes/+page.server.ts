import { testProvider } from './TestProvider.js';

export const load = () => {
	// Test ssr-safety
	const provider = testProvider();
	const unsub = provider.collection.subscribe((val) => {
		console.log(val);
		return val;
	});
	unsub();
	provider.updateAction(50);
	provider.updateAction(25);
};
