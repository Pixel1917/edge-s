import { createProvider } from '$lib/provider/index.js';

export const testProvider = createProvider({
	factory: ({ createStoreState, createDerivedStore }) => {
		// Works just like writable
		const collection = createStoreState<number[]>('unique-key', () => []);
		// Works just like derived
		const collectionLengthDoubled = createDerivedStore([collection], ([$collection]) => {
			return $collection.length * 2;
		});
		// Advanced derived
		const collectionLengthMultiplied = createDerivedStore([collection], ([$collection]) => (count: number) => {
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
