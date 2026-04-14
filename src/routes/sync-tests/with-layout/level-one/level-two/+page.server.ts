import type { Actions, PageServerLoad } from './$types.js';
import { syncTestProvider } from '../../../SyncTestProvider.js';

const nextServerNumber = () => Math.floor(Date.now() + Math.random() * 1000);

export const load: PageServerLoad = async () => {
	const store = syncTestProvider();
	store.pageCounter.value = nextServerNumber();

	return {
		levelTwoDescription: 'Deep nested page. Form action mutates layoutCounter/pageCounter/actionCounter to verify sync + invalidation.'
	};
};

export const actions: Actions = {
	bump: async () => {
		const store = syncTestProvider();
		store.layoutCounter.value = nextServerNumber();
		store.pageCounter.value = nextServerNumber();
		store.actionCounter.value = nextServerNumber();
		store.actionPayload.value = `bump-${store.actionCounter.value}`;
		return {
			ok: true,
			action: 'bump'
		};
	},
	setUndefined: async () => {
		const store = syncTestProvider();
		store.actionPayload.value = undefined;
		store.actionCounter.value = nextServerNumber();
		return {
			ok: true,
			action: 'setUndefined'
		};
	}
};
