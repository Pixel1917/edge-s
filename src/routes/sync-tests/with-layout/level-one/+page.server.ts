import type { PageServerLoad } from './$types.js';
import { syncTestProvider } from '../../SyncTestProvider.js';

const nextServerNumber = () => Math.floor(Date.now() + Math.random() * 1000);

export const load: PageServerLoad = async () => {
	const store = syncTestProvider();
	store.pageCounter.value = nextServerNumber();

	return {
		levelOneDescription: 'First nested level updates the pageCounter to prove nested load sync.',
		levelOneRevision: nextServerNumber()
	};
};
