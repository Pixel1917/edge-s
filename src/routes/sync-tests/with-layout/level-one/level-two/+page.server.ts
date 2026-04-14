import type { Actions, PageServerLoad } from './$types.js';
import { syncTestProvider } from '../../../SyncTestProvider.js';

let levelTwoRevision = 0;

export const load: PageServerLoad = async () => {
	levelTwoRevision += 1;
	const store = syncTestProvider();
	store.pageCounter.value = levelTwoRevision + 2000;

	return {
		levelTwoDescription: 'Deep nested page. Form action mutates layoutCounter/pageCounter/actionCounter to verify sync + invalidation.'
	};
};

export const actions: Actions = {
	bump: async () => {
		const store = syncTestProvider();
		store.layoutCounter.value += 10;
		store.pageCounter.value += 1;
		store.actionCounter.value += 1;
		store.actionPayload.value = `bump-${store.actionCounter.value}`;
		return {
			ok: true,
			action: 'bump'
		};
	},
	setUndefined: async () => {
		const store = syncTestProvider();
		store.actionPayload.value = undefined;
		store.actionCounter.value += 1;
		return {
			ok: true,
			action: 'setUndefined'
		};
	}
};
