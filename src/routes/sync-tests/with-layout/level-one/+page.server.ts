import type { PageServerLoad } from './$types.js';
import { syncTestProvider } from '../../SyncTestProvider.js';

let levelOneRevision = 0;

export const load: PageServerLoad = async () => {
	levelOneRevision += 1;
	const store = syncTestProvider();
	store.pageCounter.value = levelOneRevision + 1000;

	return {
		levelOneDescription: 'First nested level updates the pageCounter to prove nested load sync.',
		levelOneRevision
	};
};
