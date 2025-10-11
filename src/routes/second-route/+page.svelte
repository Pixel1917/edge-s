<script lang="ts">
	import { enhance } from '$app/forms';
	import { secondTestProvider } from '../SecondTestProvider.js';
	import { invalidateAll } from '$app/navigation';

	const { user } = secondTestProvider();
</script>

<h1>Second Page</h1>

<div style="padding: 20px; border: 2px solid green; margin: 20px 0;">
	<h2>User State Test</h2>
	{#if user.value}
		<p>User ID: {user.value.id}</p>
		<p>User Name: {user.value.name}</p>
	{:else}
		<p>No user</p>
	{/if}
</div>

<a href="/">Back to main page</a>

<p style="margin-top: 20px; padding: 10px; background: #f0f0f0;">
	<strong>Test Instructions:</strong><br />
	1. Check the user on this page (should be "User from Second Page")<br />
	2. Go back to main page<br />
	3. User should update automatically!<br />
	4. Check browser console for logs
</p>

<button onclick={() => invalidateAll()}>invalidate</button>

<form action="?/change" method="POST" use:enhance>
	<button type="submit">submit</button>
</form>
