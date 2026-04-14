import type { PageServerLoad } from './$types.js';
import { syncTestProvider } from '../SyncTestProvider.js';

let withLayoutPageRevision = 0;

export const load: PageServerLoad = async () => {
	withLayoutPageRevision += 1;
	const store = syncTestProvider();
	store.pageCounter.value = withLayoutPageRevision;

	return {
		pageDescription: 'Root page under +layout.server.ts updates its own state key.',
		pageRevision: withLayoutPageRevision
	};
};
