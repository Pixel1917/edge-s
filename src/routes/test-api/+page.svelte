<script lang="ts">
	import { secondTestProvider } from '../SecondTestProvider.js';

	const { user } = secondTestProvider();

	let results = $state<Record<string, unknown>>({});
	let loading = $state<Record<string, boolean>>({});
	let errors = $state<Record<string, string>>({});

	async function testEndpoint(name: string, url: string) {
		loading[name] = true;
		errors[name] = '';
		results[name] = null;

		try {
			const response = await fetch(url);
			const contentType = response.headers.get('content-type');

			if (contentType?.includes('application/json')) {
				results[name] = await response.json();
			} else {
				const text = await response.text();
				results[name] = { text, contentType };
			}
		} catch (error) {
			errors[name] = error instanceof Error ? error.message : String(error);
		} finally {
			loading[name] = false;
		}
	}

	async function testAllEndpoints() {
		await Promise.all([
			testEndpoint('edges-state', '/api/test/edges-state'),
			testEndpoint('plain-json', '/api/test/plain-json'),
			testEndpoint('external-mock', '/api/test/external-mock'),
			testEndpoint('malformed-json', '/api/test/malformed-json'),
			testEndpoint('non-json', '/api/test/non-json')
		]);
	}

	// Test external API call (GitHub)
	async function testRealExternalAPI() {
		await testEndpoint('github-api', 'https://api.github.com/repos/anthropics/anthropic-sdk-typescript');
	}
</script>

<h1>API Testing Page</h1>

<div style="padding: 20px; border: 2px solid blue; margin: 20px 0;">
	<h2>Current State Check</h2>
	<p>User State: {user.value ? JSON.stringify(user.value) : 'null/undefined'}</p>
</div>

<div style="padding: 20px; border: 2px solid green; margin: 20px 0;">
	<h2>Internal API Tests</h2>
	<button onclick={() => testAllEndpoints()}>Test All Internal Endpoints</button>
	<button onclick={() => testEndpoint('edges-state', '/api/test/edges-state')}>Test Edges State</button>
	<button onclick={() => testEndpoint('plain-json', '/api/test/plain-json')}>Test Plain JSON</button>
	<button onclick={() => testEndpoint('external-mock', '/api/test/external-mock')}>Test External Mock</button>
	<button onclick={() => testEndpoint('malformed-json', '/api/test/malformed-json')}>Test Malformed JSON</button>
	<button onclick={() => testEndpoint('non-json', '/api/test/non-json')}>Test Non-JSON</button>
</div>

<div style="padding: 20px; border: 2px solid orange; margin: 20px 0;">
	<h2>External API Tests</h2>
	<button onclick={() => testRealExternalAPI()}>Test Real GitHub API</button>
</div>

<div style="padding: 20px; border: 2px solid purple; margin: 20px 0;">
	<h2>Results</h2>
	{#each Object.entries(results) as [name, result] (name)}
		<div style="margin: 10px 0; padding: 10px; border: 1px solid gray;">
			<h3>{name} {loading[name] ? '⏳' : '✓'}</h3>
			{#if errors[name]}
				<p style="color: red;">Error: {errors[name]}</p>
			{:else if result}
				<pre style="background: #f5f5f5; padding: 10px; overflow: auto; max-height: 300px;">{JSON.stringify(result, null, 2)}</pre>
			{/if}
		</div>
	{/each}
</div>

<a href="/">Back to main page</a>
