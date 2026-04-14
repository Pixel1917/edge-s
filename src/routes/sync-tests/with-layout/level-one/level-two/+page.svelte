<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { syncTestProvider } from '../../../SyncTestProvider.js';
	import type { PageProps } from './$types.js';

	let { data }: PageProps = $props();
	const store = syncTestProvider();

	const noInvalidateEnhance = () => {
		return async ({ update }: { update: (opts?: { invalidateAll?: boolean; reset?: boolean }) => Promise<void> }) => {
			await update({ invalidateAll: false, reset: false });
		};
	};
</script>

<h3>Level Two Action Page</h3>
<p data-testid="level-two-description">{data.levelTwoDescription}</p>

<p data-testid="level-two-layout-counter">Layout counter: {store.layoutCounter.value}</p>
<p data-testid="level-two-page-counter">Page counter: {store.pageCounter.value}</p>
<p data-testid="level-two-action-counter">Action counter: {store.actionCounter.value}</p>
<p data-testid="level-two-action-payload">
	Action payload:
	{#if store.actionPayload.value === undefined}
		undefined
	{:else}
		{store.actionPayload.value}
	{/if}
</p>

<form action="?/bump" method="POST" use:enhance={noInvalidateEnhance}>
	<button data-testid="level-two-bump" type="submit">Run bump action</button>
</form>

<form action="?/setUndefined" method="POST" use:enhance={noInvalidateEnhance}>
	<button data-testid="level-two-undefined" type="submit">Set payload undefined</button>
</form>

<button data-testid="level-two-invalidate" onclick={() => invalidateAll()}>Invalidate all</button>
