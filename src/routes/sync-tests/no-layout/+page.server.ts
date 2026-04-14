import type { PageServerLoad } from './$types.js';
import { syncTestProvider } from '../SyncTestProvider.js';

let noLayoutRevision = 0;

export const load: PageServerLoad = async () => {
	noLayoutRevision += 1;
	const store = syncTestProvider();
	store.scenario.value = 'no-layout';
	store.pageCounter.value = noLayoutRevision;

	return {
		caseDescription: 'No +layout.server.ts. State is changed only in +page.server.ts.',
		revision: noLayoutRevision
	};
};
