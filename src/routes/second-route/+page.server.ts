import { secondTestProvider } from '../SecondTestProvider.js';

export const load = async () => {
	// const provider = secondTestProvider();
	// if (provider.user.value?.id !== 555) {
	// 	provider.user.value = {
	// 		id: 999,
	// 		name: 'User from Second Page (should sync!)'
	// 	};
	// }
};

export const actions = {
	change: async () => {
		const provider = secondTestProvider();
		provider.user.value = {
			id: 555,
			name: 'User from action'
		};
	},
	undField: async () => {
		const provider = secondTestProvider();
		provider.user.value = undefined;
	}
};
