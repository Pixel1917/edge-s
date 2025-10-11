# EdgeS

### A blazing-fast, extremely lightweight and SSR-friendly store for SvelteKit.

**EdgeS** brings seamless, per-request state management to Svelte apps — fully reactive, server-aware, and serialization-safe by default.

No context boilerplate. No hydration headaches. Just drop-in SSR-compatible state primitives with built-in support for client-side reactivity and server-side isolation.

- 🔄 Unified state for server and client
- 🧠 Persistent per-request memory via `AsyncLocalStorage`
- 💧 Tiny API
- 💥 Instant serialization without magic
- 🧩 Dependency injection, zero runtime overhead

> Designed for **SvelteKit**.

---

## Installation

```bash
npm install edges-svelte
```

---

## Setup

To enable **EdgeS** install edgesPlugin, it will wrap your SvelteKit `handle` hook with AsyncLocalStorage:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from 'edges-svelte/plugin';

export default defineConfig({
	plugins: [sveltekit(), edgesPlugin()]
});
```

---

## Basic usage

### `createStore` - creates a store function that can manage states

```ts
import { createStore } from 'edges-svelte';
// First argument is a unique name. Each store must havew a unique name.
const myStore = createStore('MyStore', ({ createState, createDerivedState }) => {
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
	import { myStore } from 'your-alias';

	const { collection, collectionLengthDoubled, updateAction } = myStore();
</script>

{$collection.join(', ')}
{$collectionLengthDoubled}
<!-- 0 before button click, 2 after button click -->
{$collectionLengthMultiplied(5)}
<!-- 0 before button click, 5 after button click -->
<button onclick={() => updateAction(25)}>count update</button>
<!-- Will update the state -->
```

- 💡 All stores created inside `createStore` use unique keys automatically and are request-scoped
- 🛡️ Fully SSR-safe — stores are isolated per request and serialized automatically

---

## Store Caching (built-in)

Stores are cached per request by their unique name (cache key). Calling the same store multiple times in the same request returns the cached instance.

```ts
const myCachedStore = createStore('MyCachedStore', ({ createState }) => {
	const data = createState(() => 'cached data');
	return { data };
});
```

---

## Core Concepts

### SSR-safe state access

State is isolated per request using `AsyncLocalStorage` internally. You never share data between users.

You **must** always create stores inside using `createStore`.

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

You can inject dependencies into providers with `createStoreFactory`:

```ts
const withDeps = createStoreFactory({ user: getUserFromSession });

const useUserStore = withDeps('UserStore', ({ user, createState }) => {
	const userState = createState(user);
	return { userState };
});
```

---

## createPresenter

A cached provider for UI logic without direct state management primitives. Perfect for separating business logic from state management.

#### When to use

createPresenter is ideal when you want to:

1. Keep state management separate from UI logic
2. Create reusable business logic that doesn't directly manage state
3. Build presenters that orchestrate between services and stores
4. Follow clean architecture patterns with clear separation of concerns

Difference from createStore
While createStore provides state primitives (createState, createDerivedState, createRawState), createPresenter focuses purely on business logic and coordination. It maintains all the caching and dependency injection features of createStore but without state management utilities.

---

## Exports summary

| Feature                                                                          | Import from           |
| -------------------------------------------------------------------------------- | --------------------- |
| `createStore`, `createStoreFactory`, `createPresenter`, `createPresenterFactory` | `edges-svelte`        |
| `edgesPlugin`                                                                    | `edges-svelte/plugin` |

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
