<script lang="ts">
	import { page } from '$app/state';
	import { applyEdgesFromPayload } from './NavigationSync.svelte.js';

	$effect(() => {
		applyEdgesFromPayload(page.data);
		applyEdgesFromPayload(page.form);
	});
</script>
