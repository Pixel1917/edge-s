import { createProvider } from '$lib/provider/index.js';

export const testProvider = createProvider({
	factory: ({ createState, createDerivedState }) => {
		// Works just like writable
		const collection = createState<number[]>('unique-key', () => []);
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

		return { collection, collectionLengthDoubled, collectionLengthMultiplied, updateAction };
	}
});
