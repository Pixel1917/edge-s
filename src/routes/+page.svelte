<script lang="ts">
	import { testProvider } from './TestProvider.js';

	const { collection, collectionLengthDoubled, collectionLengthMultiplied, updateAction } = testProvider();
</script>

{$collection.join(', ')}
{$collectionLengthDoubled}
<!-- 0 before button click, 2 after button click -->
{$collectionLengthMultiplied(5)}
<!-- 0 before button click, 5 after button click -->
<button onclick={() => updateAction(25)}>count update</button>
<!-- Will update the state -->
