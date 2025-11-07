import { testProvider } from './TestProvider.js';
import { secondTestProvider } from './SecondTestProvider.js';

export const load = async () => {
	// Test ssr-safety
	const provider = testProvider();
	const unsub = provider.collection.subscribe((val) => {
		return val;
	});
	unsub();
	const unsub2 = provider.someState.subscribe((val) => {
		return val;
	});
	unsub2();
	const rand = Math.random();
	console.log(rand);
	provider.updateAction(rand);
	provider.updateAction(Math.random());

	//second provider
	const secondProvider = secondTestProvider();
	await secondProvider.setUser();
};
