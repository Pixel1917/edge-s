import { secondTestProvider, secondTestPresenter } from '../SecondTestProvider.js';

export const load = async ({ locals }) => {
	const provider = secondTestProvider();
	console.log('load locals', locals);
	console.log('load', provider.user.value);
	// if (provider.user.value?.id !== 555) {
	// 	provider.user.value = {
	// 		id: 999,
	// 		name: 'User from Second Page (should sync!)'
	// 	};
	// }
};

export const actions = {
	change: async ({ locals, cookies }) => {
		const provider = secondTestProvider();
		provider.user.value = {
			id: 555,
			name: 'User from action'
		};
		locals.lol = 1;
		console.log('change', locals);
		cookies.set('lol', '1', { path: '/' });
		return { success: true };
	},
	undField: async () => {
		const provider = secondTestProvider();
		provider.user.value = undefined;
	},
	do: async () => {
		const { doInterestingThing, addPost } = secondTestPresenter();
		doInterestingThing();
		addPost();
	}
};
