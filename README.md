# Edge-S

### A blazing-fast, extremely lightweight and SSR-friendly store for Svelte.

**Edge-S** brings seamless, per-request state management to Svelte apps — fully reactive, server-aware, and serialization-safe by default.

No context boilerplate. No hydration headaches. Just drop-in SSR-compatible state primitives with built-in support for client-side reactivity and server-side isolation.

- 🔄 Unified state for server and client
- 🧠 Persistent per-request memory via `AsyncLocalStorage`
- 💧 Tiny API — no subscriptions needed unless you want them
- 💥 Instant serialization without magic
- 🧩 Provider-based dependency injection, zero runtime overhead

> Designed for **SvelteKit**.

---

## Installation

```bash
npm install edge-s
```

---

## Setup

To enable **Edge-S**, wrap your SvelteKit `handle` hook and serialize the state in `transformPageChunks`:

```ts
// hooks.server.ts
import { edgesHandle } from 'edge-s/server';

export const handle: Handle = async ({ event, resolve }) => {
	return edgesHandle(
		event,
		({ serialize, edgesEvent }) => {
			//...Your handle code, use edgesEvent as a default svelte event (RequestEvent)
			return resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) });
		},
		true
	);
};
```

---

## Basic usage

### `createProvider` - creates store with access to `createState` and `createDerivedState`

```ts
import { createProvider } from 'edge-s';

const myProvider = createProvider({
	factory: ({ createState, createDerivedState }) => {
		// Works just like writable
		const collection = createState<number[]>('unique-key', () => []);
		// Works just like derived
		const collectionLengthDoubled = createDerivedState([collection], ([$c]) => $c.length * 2);
		// Advanced derived
		const collectionLengthMultiplied = createDerivedState([collection], ([$c]) => (count: number) => {
			return $c.length * count;
		});

		const updateAction = (num: number) => {
			collection.update((n) => {
				n = [...n, num];
				return n;
			});
		};

		// ...Your code;

		return { collection, collectionLengthDoubled, collectionLengthMultiplied, updateAction };
	}
});
```

```sveltehtml
<script lang="ts">
  import {myProvider} from 'your-alias';

  const {collection, collectionLengthDoubled, collectionLengthMultiplied, updateAction} = myProvider();
</script>

{$collection.join(', ')} <!-- Empty string before button click, 25 after button click -->
{$collectionLengthDoubled} <!-- 0 before button click, 2 after button click -->
{$collectionLengthMultiplied(5)}  <!-- 0 before button click, 5 after button click -->
<button onclick={() => updateAction(25)}></button>  <!-- Will update the state -->
```

- 💡 You get access to `createRawState`, `createState`, and `createDerivedState` in providers created by `createProvider`
- 🛡️ Fully SSR-safe — all internal state is per-request

---

## Core Concepts

### SSR-safe state access

All state is isolated per request and never shared between users thanks to `AsyncLocalStorage`. Access to state primitives (`createRawState`, `createState`, `createDerivedState`) is only possible through provider functions — ensuring that you never accidentally share state across requests.

---

## State Primitives

### `createState`

```ts
const count = createState('count', () => 0);

$count;
// in template: {$count}

count.update((n) => n + 1);
```

> This behaves like native Svelte `writable`, but scoped to request. Fully SSR-safe.

---

### `createDerivedStore`

```ts
const count = createState('count', () => 1);
const doubled = createDerivedState([count], ([$n]) => $n * 2);

$doubled;
```

> Works just like Svelte’s `derived`, but fully SSR-compatible. On the server, computes once and reuses the value.

---

### `createRawState`

```ts
const counter = createRawState('counter', () => 0);
counter.value += 1;
```

> Lightweight, reactive, SSR-safe variable. No subscriptions. Access through `.value`.

- ✅ Fully server-aware
- ✅ Serialization-safe
- ✅ Sync updates

---

## Dependency Injection

### `createProviderFactory`

For shared injected dependencies:

```ts
const withDeps = createProviderFactory({ user: getUserFromSession });

const useUserStore = withDeps({
	factory: ({ user, createState }) => {
		const userState = createState('user', () => user);
		return { userState };
	}
});
```

---

## Imports

| Feature                                   | Import from     |
| ----------------------------------------- | --------------- |
| `createProvider`, `createProviderFactory` | `edge-s`        |
| `edgesHandle`                             | `edge-s/server` |

---

## Best Practices

- Use unique keys for each state to avoid collisions
- Always create your states via providers to avoid shared memory across requests
- Prefer `createProvider` even for simple state logic — it scales better and stays testable

---

## About edgesHandle

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

### Why not just use `writable, derived`?

Because `writable` and `derived` shares state between requests when used on the server. That means users could leak state into each other’s responses. **Edge-S** solves that by isolating state per request.

### Difference between `createState` and `createRawState`

`createRawState` is just like `$state`, but ssr-safe. It is a lightweight reactive variable and has no subscription. Access and change value through `.value`.
💡 Use `myState.value` to get/set the value directly — no `$` sugar and set, update methods.

---

## License

[MIT](./LICENSE)

---

Crafted with ❤️ by Pixel1917.
