<script lang="ts">
	import { syncTestProvider } from '../SyncTestProvider.js';
	import type { LayoutProps } from './$types.js';

	let { data, children }: LayoutProps = $props();
	const store = syncTestProvider();
</script>

<section style="padding: 12px; border: 1px solid #cfd8dc;">
	<h2>With Layout Shell</h2>
	<p data-testid="with-layout-description">{data.layoutDescription}</p>
	<p data-testid="with-layout-layout-counter">Layout counter: {store.layoutCounter.value}</p>
	<p data-testid="with-layout-scenario">Scenario: {store.scenario.value}</p>
	<nav style="display: flex; gap: 10px; margin-bottom: 10px;">
		<a href="/sync-tests/with-layout">Root</a>
		<a href="/sync-tests/with-layout/level-one">Level one</a>
		<a href="/sync-tests/with-layout/level-one/level-two">Level two action</a>
	</nav>
	{@render children()}
</section>
