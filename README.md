# EdgeS

### A blazing-fast, extremely lightweight and SSR-friendly store for SvelteKit.

**EdgeS** brings seamless, per-request state management to Svelte apps — fully reactive, server-aware, and serialization-safe by default.

No context boilerplate. No hydration headaches. Just drop-in SSR-compatible state primitives with built-in support for client-side reactivity and server-side isolation.

- 🔄 Unified state for server and client
- 🧠 Persistent per-request memory via `AsyncLocalStorage`
- 💧 Tiny API
- 💥 Instant serialization without magic
- 🧩 Provider-based dependency injection, zero runtime overhead

> Designed for **SvelteKit**.

---

## Installation

```bash
npm install edges-svelte
```

---

## Setup

To enable **EdgeS**, wrap your SvelteKit `handle` hook and serialize the state in `transformPageChunks`:

```ts
// hooks.server.ts
import { dev } from '$app/environment';
import { edgesHandle } from 'edges-svelte/server';

export const handle: Handle = async ({ event, resolve }) => {
	return edgesHandle(
		event,
		({ serialize, edgesEvent }) => {
			//...Your handle code, use edgesEvent as a default svelte event (RequestEvent)
			return resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) });
		},
		dev
	);
};
```

---

## Basic usage

### `createProvider` - creates a provider function that can manage states

```ts
import { createProvider } from 'edges-svelte';

const myProvider = createProvider('MyProvider', ({ createState, createDerivedState }) => {
	// createState creates a writable, SSR-safe store with a unique key
	const collection = createState<number[]>([]);
	// createDerivedState creates a derived store, SSR-safe as well
	const collectionLengthDoubled = createDerivedState([collection], ([$c]) => $c.length * 2);

	const updateAction = (num: number) => {
		collection.update((n) => [...n, num]);
	};

	return { collection, collectionLengthDoubled, updateAction };
});
```

```svelte
<script lang="ts">
	import { myProvider } from 'your-alias';

	const { collection, collectionLengthDoubled, updateAction } = myProvider();
</script>

{$collection.join(', ')}
{$collectionLengthDoubled}
<!-- 0 before button click, 2 after button click -->
{$collectionLengthMultiplied(5)}
<!-- 0 before button click, 5 after button click -->
<button onclick={() => updateAction(25)}>count update</button>
<!-- Will update the state -->
```

- 💡 All stores created inside `createProvider` use unique keys automatically and are request-scoped
- 🛡️ Fully SSR-safe — stores are isolated per request and serialized automatically

---

## Provider Caching (built-in)

Providers are cached per request by their unique provider name (cache key). Calling the same provider multiple times in the same request returns the cached instance.

```ts
const myCachedProvider = createProvider('MyCachedProvider', ({ createState }) => {
	const data = createState(() => 'cached data');
	return { data };
});
```

---

## Core Concepts

### SSR-safe state access

State is isolated per request using `AsyncLocalStorage` internally. You never share data between users.

You **must** always create stores inside providers returned by `createProvider`.

---

## State Primitives

### `createState`

```ts
const count = createState(0);

$count; // reactive store value

count.update((n) => n + 1);
```

> Behaves like Svelte’s `writable`, but is fully SSR-safe and scoped per-request.

---

### `createDerivedState`

```ts
const count = createState(1);
const doubled = createDerivedState([count], ([$n]) => $n * 2);

$doubled;
```

> Like Svelte’s `derived`.

---

### `createRawState`

```ts
const counter = createRawState(0);
counter.value += 1;
```

> Lightweight reactive variable, SSR-safe, no subscriptions, direct `.value` access.

---

## Dependency Injection

You can inject dependencies into providers with `createProviderFactory`:

```ts
const withDeps = createProviderFactory({ user: getUserFromSession });

const useUserStore = withDeps('UserStore', ({ user, createState }) => {
	const userState = createState(user);
	return { userState };
});
```

---

## Exports summary

| Feature                                   | Import from           |
| ----------------------------------------- | --------------------- |
| `createProvider`, `createProviderFactory` | `edges-svelte`        |
| `edgesHandle`                             | `edges-svelte/server` |

---

## About `edgesHandle`

```ts
/**
 * Wraps request handling in an AsyncLocalStorage context and provides a `serialize` function
 * for injecting state into the HTML response.
 *
 * @param event - The SvelteKit RequestEvent for the current request.
 * @param callback - A function that receives the edgesEvent and a serialize function,
 *   and expects resolve of edgesEvent as a return result.
 * @param silentChromeDevtools - If true, intercepts requests to
 *   `/.well-known/appspecific/com.chrome.devtools.json` (triggered by Chrome DevTools)
 *   and returns a 204 No Content response just to avoid spamming logs.
 */
type EdgesHandle = (
	event: RequestEvent,
	callback: (params: { edgesEvent: RequestEvent; serialize: (html: string) => string }) => Promise<Response> | Response,
	silentChromeDevtools?: boolean
) => Promise<Response>;
```

---

## FAQ

### Why not just use `writable`, `derived` from Svelte?

Because those stores share state between requests when used on the server, potentially leaking data between users.

EdgeS ensures per-request isolation, so your server state is never shared accidentally.

### What is the difference between `createState` and `createRawState`?

- `createState` returns a full Svelte writable store with subscription and `$` store syntax.
- `createRawState` is a minimal reactive variable, no subscriptions, accessed via `.value`.

Use `createRawState` for simple values where you don’t need reactive subscriptions.

---

## License

[MIT](./LICENSE)

---

Crafted with ❤️ by Pixel1917.
