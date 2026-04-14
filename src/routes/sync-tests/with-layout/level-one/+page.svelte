<script lang="ts">
	import { syncTestProvider } from '../../SyncTestProvider.js';
	import type { PageProps } from './$types.js';

	let { data }: PageProps = $props();
	const store = syncTestProvider();
</script>

<h3>Level One Page</h3>
<p data-testid="level-one-description">{data.levelOneDescription}</p>
<p data-testid="level-one-page-counter">Page counter: {store.pageCounter.value}</p>
<p><a href="/sync-tests/with-layout/level-one/level-two">Go to level two action page</a></p>
