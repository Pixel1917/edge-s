<script lang="ts">
	import { testProvider } from './TestProvider.js';
	import { secondTestProvider } from './SecondTestProvider.js';
	import { injectedTestProvider } from './FactoryProvider.js';

	const { someState, someRawState, collection, collectionLengthDoubled, collectionLengthMultiplied, updateAction } = testProvider();

	const { user, unsetUser, addPost, posts } = secondTestProvider();

	const { someState: injected, update } = injectedTestProvider();
</script>

{$collection.join(', ')}
{$collectionLengthDoubled}
<!-- 0 before button click, 2 after button click -->
{$collectionLengthMultiplied(5)}
<!-- 0 before button click, 5 after button click -->
<button onclick={() => updateAction(25)}>count update</button>
<!-- Will update the state -->

{$someState}
<button onclick={() => someState.set(50)}>set some state</button>
<button onclick={() => someState.update((val) => val + 15)}>update some state</button>

{someRawState.value}
<button onclick={() => (someRawState.value += ' test')}>change raw</button>
<br />
<hr />

{#if user.value}
	{user.value.id} - {user.value.name}
{/if}
<button onclick={() => unsetUser()}>unset</button>
<br />
<hr />
<br />
{#each $posts as post (post.id)}
	{post.id} - {post.name}
{/each}

<button onclick={() => addPost()}>add post</button>

<br />
<hr />

{injected.value}

<button onclick={() => update()}>check injection</button>
