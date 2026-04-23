<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { syncTestProvider } from '../SyncTestProvider.js';
	import type { PageProps } from './$types.js';

	let { data }: PageProps = $props();
	const store = syncTestProvider();
</script>

<h1>No Layout Case</h1>
<p data-testid="case-description">test: {data.caseDescription}</p>
<p data-testid="no-layout-scenario">Scenario: {store.scenario.value}</p>
<p data-testid="no-layout-page-counter">Page counter: {store.pageCounter.value}</p>
<p data-testid="no-layout-layout-counter">Layout counter: {store.layoutCounter.value}</p>

<button data-testid="no-layout-invalidate" onclick={() => invalidateAll()}>Invalidate all</button>
