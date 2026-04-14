import type { PageServerLoad } from './$types.js';
import { syncTestProvider } from '../SyncTestProvider.js';

const nextServerNumber = () => Math.floor(Date.now() + Math.random() * 1000);

export const load: PageServerLoad = async () => {
	const store = syncTestProvider();
	store.pageCounter.value = nextServerNumber();

	return {
		pageDescription: 'Root page under +layout.server.ts updates its own state key.',
		pageRevision: nextServerNumber()
	};
};
