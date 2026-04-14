import type { PageServerLoad } from './$types.js';
import { syncTestProvider } from '../SyncTestProvider.js';

const nextServerNumber = () => Math.floor(Date.now() + Math.random() * 1000);

export const load: PageServerLoad = async () => {
	const store = syncTestProvider();
	store.scenario.value = 'no-layout';
	store.pageCounter.value = nextServerNumber();

	return {
		caseDescription: 'No +layout.server.ts. State is changed only in +page.server.ts.',
		revision: nextServerNumber()
	};
};
