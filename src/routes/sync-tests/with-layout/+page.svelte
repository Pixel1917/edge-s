<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { syncTestProvider } from '../SyncTestProvider.js';
	import type { PageProps } from './$types.js';

	let { data }: PageProps = $props();
	const store = syncTestProvider();
</script>

<h3>With Layout Root Page</h3>
<p data-testid="with-layout-page-description">{data.pageDescription}</p>
<p data-testid="with-layout-page-counter">Page counter: {store.pageCounter.value}</p>
<p data-testid="with-layout-action-counter">Action counter: {store.actionCounter.value}</p>

<button data-testid="with-layout-invalidate" onclick={() => invalidateAll()}>Invalidate all</button>
