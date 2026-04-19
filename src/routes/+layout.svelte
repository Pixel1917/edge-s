<script lang="ts">
	let { children } = $props();
	import DevTools from '$lib/utils/DevTools.svelte';
</script>

<header style="padding: 12px; border-bottom: 1px solid #ddd; margin-bottom: 16px;">
	<strong>EdgeS Sync Test Cases:</strong>
	<nav style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px;">
		<a href="/sync-tests">Overview</a>
		<a href="/sync-tests/no-layout">No layout load</a>
		<a href="/sync-tests/with-layout">With layout + page</a>
		<a href="/sync-tests/with-layout/level-one">With layout level one</a>
		<a href="/sync-tests/with-layout/level-one/level-two">Deep action page</a>
	</nav>
</header>

{@render children?.()}
<DevTools />
