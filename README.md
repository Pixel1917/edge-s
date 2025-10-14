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
const myStore = createStore(({ createState, createDerivedState }) => {
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
const myCachedStore = createStore(({ createState }) => {
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

You can inject dependencies into stores with `createStoreFactory`:

```ts
const withDeps = createStoreFactory({ user: getUserFromSession });

const useUserStore = withDeps(({ user, createState }) => {
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

## Batched Updates

```typescript
import { batch, transaction } from 'edges-svelte';

// Batch multiple state updates to avoid re-renders
export const updateUserData = () => {
	const store = useUserStore();

	batch(() => {
		store.user.value = { id: 1, name: 'John' };
		store.isLoggedIn.set(true);
		store.preferences.set({ theme: 'dark' });
		// All updates happen in a single render cycle!
	});
};

// Transaction API for async operations
export const saveUserSettings = async (settings: Settings) => {
	return transaction(async () => {
		const store = useUserStore();

		const result = await api.saveSettings(settings);
		store.settings.set(result);
		store.lastSaved.set(new Date());

		return result;
	});
};
```

---

## DevTools Integration

```typescript
// DevTools are automatically enabled in development
// Access them in browser console:

window.__EDGES_DEVTOOLS__.visualizeState(); // See state tree
window.__EDGES_DEVTOOLS__.getStats(); // Get performance stats
window.__EDGES_DEVTOOLS__.clearCache(); // Clear state cache

// The package will warn you about:
// - Large state objects (>50KB)
// - Direct state mutations
// - Factory collisions
// - Slow operations (>16ms)
```

---

## Monitoring & Debugging

```typescript
// Enable detailed logging in development
import { DevTools } from 'edges-svelte/dev';

// Monitor state changes
const store = useUserStore();
DevTools.warnOnLargeState('user', store.user.value);

// Measure performance
DevTools.measurePerformance('heavy-computation', () => {
	// Your code here
});

// Visualize state in console
if (browser && dev) {
	DevTools.visualizeStateTree(window.__SAFE_SSR_STATE__);
}
```

---

## Minification-safe stores

### Method 1: Pass key as first argument

```typescript
// Super clean - just pass the unique key as first argument!
export const useUserStore = createStore('user-store', ({ createState, createRawState }) => {
	const user = createRawState<User | null>(null);
	const isLoggedIn = createState(false);

	return { user, isLoggedIn };
});

// Same for presenters
export const useAuthPresenter = createPresenter('auth-presenter', () => {
	const login = async (credentials) => {};
	const logout = () => {};

	return { login, logout };
});
```

---

## State Compression

### Method 1: Via Plugin (Recommended) ✨

```typescript
// vite.config.ts - Zero config compression!
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from 'edges-svelte/plugin';

export default defineConfig({
	plugins: [
		sveltekit(),
		edgesPlugin({
			compression: {
				enabled: true, // Enable compression
				threshold: 2048 // Compress states > 2KB
			},
			silentChromeDevtools: true // Optional: silence devtools requests
		})
	]
});

// That's it! No need to touch hooks.server.ts
```

### Method 2: Manual Setup (For advanced use cases)

```typescript
// hooks.server.ts - If you need custom control
import { edgesHandle } from 'edges-svelte/server';

export const handle = edgesHandle(({ serialize, edgesEvent, resolve }) => {
	return resolve(edgesEvent, {
		transformPageChunk: ({ html }) =>
			serialize(html, {
				compress: true, // Enable compression
				compressionThreshold: 2048 // Compress states > 2KB
			})
	});
});
```

---

## Exports summary

| Feature                                                                                                  | Import from           |
| -------------------------------------------------------------------------------------------------------- | --------------------- |
| `createStore`, `createStoreFactory`, `createPresenter`, `createPresenterFactory`, `batch`, `transaction` | `edges-svelte`        |
| `edgesPlugin`                                                                                            | `edges-svelte/plugin` |
| `edgesHandle`                                                                                            | `edges-svelte/server` |
| `DevTools`                                                                                               | `edges-svelte/dev`    |

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
