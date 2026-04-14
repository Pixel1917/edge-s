import type { LayoutServerLoad } from './$types.js';
import { syncTestProvider } from '../SyncTestProvider.js';

const nextServerNumber = () => Math.floor(Date.now() + Math.random() * 1000);

export const load: LayoutServerLoad = async () => {
	const store = syncTestProvider();
	store.scenario.value = 'with-layout';
	store.layoutCounter.value = nextServerNumber();

	return {
		layoutDescription: 'This route has +layout.server.ts and nested pages. Layout updates shared state.',
		layoutRevision: nextServerNumber()
	};
};
