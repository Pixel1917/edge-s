import { testProvider } from './TestProvider.js';
import { secondTestProvider } from './SecondTestProvider.js';

export const load = async () => {
	// Test ssr-safety
	const provider = testProvider();
	const unsub = provider.collection.subscribe((val) => {
		console.log(val);
		return val;
	});
	unsub();
	const unsub2 = provider.someState.subscribe((val) => {
		console.log(val);
		return val;
	});
	unsub2();
	provider.updateAction(Math.random());
	provider.updateAction(Math.random());

	//second provider
	const secondProvider = secondTestProvider();
	console.log(secondProvider.user);
	await secondProvider.setUser();
};
