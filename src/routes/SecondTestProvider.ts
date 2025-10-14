import { createStore } from '$lib/provider/index.js';

type UserType = {
	id: number;
	name: string;
	settings?: {
		theme?: string;
		notifications?: boolean;
		nested?: {
			deep?: string;
			veryDeep?: number;
		};
	};
};

export const secondTestProvider = createStore('SecondTestProvider', ({ createState, createDerivedState, createRawState }) => {
	const posts = createState<{ id: number; name: string }[]>([{ id: 1, name: 'base-post' }]);
	const user = createRawState<UserType | null | undefined>(null);
	const collectionLengthDoubled = createDerivedState<[typeof posts], number>([posts], ([$collection]) => {
		return $collection.length * 2;
	});

	const addPost = () => {
		posts.update((n) => {
			n = [...n, { id: n.length + 1, name: 'a'.repeat(1000000) }];
			return n;
		});
	};

	const setUser = async () => {
		user.value = {
			id: 1,
			name: 'John Doe',
			settings: {
				theme: 'dark',
				notifications: true,
				nested: {
					deep: 'value',
					veryDeep: 42
				}
			}
		};
	};

	const unsetUser = () => {
		user.value = null;
	};

	// Test undefined at different levels
	const setUserWithUndefined = () => {
		user.value = undefined; // Top level undefined
	};

	const setUserWithNestedUndefined = () => {
		user.value = {
			id: 2,
			name: 'Jane',
			settings: {
				theme: undefined, // Nested undefined
				notifications: true,
				nested: {
					deep: undefined, // Deep nested undefined
					veryDeep: undefined
				}
			}
		};
	};

	return {
		posts,
		user,
		addPost,
		postsLengthDoubled: collectionLengthDoubled,
		setUser,
		unsetUser,
		setUserWithUndefined,
		setUserWithNestedUndefined
	};
});
