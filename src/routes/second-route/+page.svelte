<script lang="ts">
	import { enhance } from '$app/forms';
	import { secondTestProvider } from '../SecondTestProvider.js';
	import { invalidateAll } from '$app/navigation';

	const { user, setUserWithUndefined, setUserWithNestedUndefined } = secondTestProvider();
</script>

<h1>Second Page</h1>

<div style="padding: 20px; border: 2px solid green; margin: 20px 0;">
	<h2>User State Test</h2>
	{#if user.value === undefined}
		<p style="color: red;">User is UNDEFINED (top level)</p>
	{:else if user.value === null}
		<p>User is NULL</p>
	{:else}
		<p>User ID: {user.value.id}</p>
		<p>User Name: {user.value.name}</p>
		{#if user.value.settings}
			<p>Theme: {user.value.settings.theme ?? 'undefined'}</p>
			<p>Notifications: {user.value.settings.notifications ?? 'undefined'}</p>
			{#if user.value.settings.nested}
				<p>Nested Deep: {user.value.settings.nested.deep ?? 'undefined'}</p>
				<p>Nested VeryDeep: {user.value.settings.nested.veryDeep ?? 'undefined'}</p>
			{/if}
		{/if}
	{/if}
</div>

<div style="padding: 20px; border: 2px solid blue; margin: 20px 0;">
	<h3>Test undefined at different levels:</h3>
	<button onclick={() => setUserWithUndefined()}>Set user to UNDEFINED (top level)</button>
	<button onclick={() => setUserWithNestedUndefined()}>Set user with nested UNDEFINED fields</button>
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

<form action="?/undField" method="POST" use:enhance>
	<button type="submit">und</button>
</form>
