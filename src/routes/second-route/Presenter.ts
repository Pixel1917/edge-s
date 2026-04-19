import { createPresenter } from '$lib/provider/index.js';

export const secondTestPresenterWithDuplicateName = createPresenter('SecondTestPresenter', () => {
	const doInterestingThing = () => {
		console.log('doInterestingThing called');
	};

	return {
		doInterestingThing
	};
});
