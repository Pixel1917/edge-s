import { createProvider } from '$lib/provider/index.js';

export const secondTestProvider = createProvider('secondTestProvider', ({ createState, createDerivedState, createRawState }) => {
	const posts = createState<{ id: number; name: string }[]>([{ id: 1, name: 'base-post' }]);
	const user = createRawState<null | { id: number; name: string }>(null);
	const collectionLengthDoubled = createDerivedState([posts], ([$collection]) => {
		return $collection.length * 2;
	});

	const addPost = () => {
		posts.update((n) => {
			n = [...n, { id: n.length + 1, name: 'Random post name' }];
			return n;
		});
	};

	const setUser = async () => {
		user.value = { id: 1, name: 'John Doe' };
	};

	const unsetUser = () => {
		user.value = null;
	};

	return { posts, user, addPost, collectionLengthDoubled, setUser, unsetUser };
});
