import { createStore } from '$lib/provider/index.js';

export const testProvider = createStore(({ createState, createDerivedState, createRawState }) => {
	// Works just like writable
	const collection = createState<number[]>([]);
	const someState = createState(15);
	const someRawState = createRawState('hello my dear friend');
	// Works just like derived
	const collectionLengthDoubled = createDerivedState([collection], ([$collection]) => {
		return $collection.length * 2;
	});
	// Advanced derived
	const collectionLengthMultiplied = createDerivedState([collection], ([$collection]) => (count: number) => {
		return $collection.length * count;
	});

	const updateAction = (num: number) => {
		collection.update((n) => {
			n = [...n, num];
			return n;
		});
	};

	// ...Your code;

	return { someState, someRawState, collection, collectionLengthDoubled, collectionLengthMultiplied, updateAction };
});
