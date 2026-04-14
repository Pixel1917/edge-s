import type { LayoutServerLoad } from './$types.js';
import { syncTestProvider } from '../SyncTestProvider.js';

let layoutRevision = 0;

export const load: LayoutServerLoad = async () => {
	layoutRevision += 1;
	const store = syncTestProvider();
	store.scenario.value = 'with-layout';
	store.layoutCounter.value = layoutRevision;

	return {
		layoutDescription: 'This route has +layout.server.ts and nested pages. Layout updates shared state.',
		layoutRevision
	};
};
