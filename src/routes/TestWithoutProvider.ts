import { createRawState } from '$lib/store/index.js';

export const TestWithoutProvider = () => {
	const someState1 = createRawState<{ name: string }>('test-without', () => ({ name: 'some val' }));
	return { someState1 };
};
