# EdgeS

### A blazing-fast, extremely lightweight and SSR-friendly store for SvelteKit.

**EdgeS** brings seamless, per-request state management to Svelte apps.

No context boilerplate. No hydration headaches.

- Persistent per-request memory via `AsyncLocalStorage`
- Tiny API
- Instant serialization without magic
- Dependency injection, zero runtime overhead

EdgeS is built to prevent state leaks. Its primary goal is to keep server-side state safely isolated per request while providing a clean developer experience with presenters, stores, and automatic client updates when fresh state arrives from the server. It is intentionally one-way sync from server to client and does not aim to provide full two-way state synchronization between client and server.

### Sync Scope & Limitations

EdgeS does **not** aim to provide full server-to-client synchronization for all SvelteKit flows.

- The main goal of this package is **server-side state isolation per request**.
- Server-to-client sync is a convenience layer for common cases, not a strict consistency protocol.
- `svelte actions` with redirects are **not fully synchronized** by design.
- Redirect-driven flows (and similar edge cases) should be handled with explicit app-level patterns (for example cookies/session/flash state) when you need guaranteed transfer of action results across navigation.

> Designed for **SvelteKit**.

---

## Installation

```bash
npm install @azure-net/edges
```

---

## Setup

To enable **EdgeS** install edgesPlugin, it will wrap your SvelteKit `handle` hook with AsyncLocalStorage:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { edgesPlugin } from '@azure-net/edges/plugin';

export default defineConfig({
	plugins: [sveltekit(), edgesPlugin()]
});
```

---

## Basic usage

### `createStore` - creates a store function that can manage states

```ts
import { createStore } from '@azure-net/edges';
const myStore = createStore('MyUniqueStoreName', ({ createState, createDerivedState }) => {
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

- All stores created inside `createStore` use unique keys automatically and are request-scoped
- Fully SSR-safe — stores are isolated per request and serialized automatically

---

## Store Caching (built-in)

Stores are cached per request by their unique name (cache key). Calling the same store multiple times in the same request returns the cached instance.

```ts
const myCachedStore = createStore('MyUniqueStoreName', ({ createState }) => {
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

> Like Svelte’s `derived`. On the server side will not subscribe to store like derived, just reads initial value, on client side works like derived.

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

For provider-to-provider dependencies, inject provider functions lazily:

```ts
const useAuth = createPresenter('AuthPresenter', () => ({ isLoggedIn: true }));

const useHeader = createPresenter(
	'HeaderPresenter',
	({ useAuth }) => ({
		canShowProfile: () => useAuth().isLoggedIn
	}),
	{ useAuth }
);
```

Avoid injecting resolved provider instances. In development, edges throws a fail-fast error for eager provider injection and for circular dependency chains like `A -> B -> A`.

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
import { batch, transaction } from '@azure-net/edges';

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

### Built-in Dev Component (dev-only)

EdgeS provides a small in-app DevTools component for development.

- A `50x50` floating button appears in the bottom-right corner.
- Clicking it opens an inspector panel with tabs:
  - `presenters`
  - `stores`
  - `info`
- `presenters` shows an accordion of registered presenters with key/runtime metadata.
- `stores` shows registered stores plus state tree entries, previews, and size estimates.
- `info` includes key uniqueness checks, cache stats, and high-level resource usage.

How to enable:

- `@azure-net/edges/dev` — enables DevTools runtime API (`window.__EDGES_DEVTOOLS__`) and mounts the in-app dev UI.
- `@azure-net/edges/dev-component` — exports the Svelte component itself if you want to mount it manually.

```ts
// e.g. in +layout.svelte or app bootstrap (dev only)
import '@azure-net/edges/dev';
```

```svelte
<!-- manual mount variant -->
<script lang="ts">
	import DevToolsComponent from '@azure-net/edges/dev-component';
</script>

<DevToolsComponent />
```

Notes:

- This UI is intended only for `dev` and is not a production UI feature.
- If you do not import `@azure-net/edges/dev` (or mount `@azure-net/edges/dev-component` manually), the UI will not appear.

---

## Monitoring & Debugging

```typescript
// Enable detailed logging in development
import { DevTools } from '@azure-net/edges/dev';

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

### Pass key as first argument

```typescript
// Super clean - just pass the unique key as first argument!
export const useUserStore = createStore('MyUniqueStoreName', ({ createState, createRawState }) => {
	const user = createRawState<User | null>(null);
	const isLoggedIn = createState(false);

	return { user, isLoggedIn };
});

// Same for presenters
export const useAuthPresenter = createPresenter('MyUniquePresenterName', () => {
	const login = async (credentials) => {};
	const logout = () => {};

	return { login, logout };
});
```

You can skip specifying a unique key and pass the factory as the first argument — edges will generate a unique key for you using its internal algorithms. The chances of collisions are minimal, but they still exist.

---

## State Serialization

EdgeS serializes SSR state as plain script payloads. Transport-level compression should be handled by your HTTP stack (gzip/brotli) instead of application-level compression in this package.

---

## Exports summary

| Feature                                                                                                  | Import from                      |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `createStore`, `createStoreFactory`, `createPresenter`, `createPresenterFactory`, `batch`, `transaction` | `@azure-net/edges`               |
| `edgesPlugin`, `createEdgesPluginFactory`                                                                | `@azure-net/edges/plugin`        |
| `edgesHandle`                                                                                            | `@azure-net/edges/server`        |
| `DevTools`                                                                                               | `@azure-net/edges/dev`           |
| `DevToolsComponent`                                                                                      | `@azure-net/edges/dev-component` |

---

## Creating Wrapper Packages

If you're building a custom state management solution on top of `@azure-net/edges`, you can create your own plugin using the factory:

```typescript
// my-awesome-edges/plugin/index.ts
import { createEdgesPluginFactory } from '@azure-net/edges/plugin';

// Create your plugin with custom package name and server path
export const myAwesomePlugin = createEdgesPluginFactory(
	'my-awesome-edges', // Your package name
	'my-awesome-edges/server' // Your server module path
);
```

Then your users can use it just like the original:

```typescript
// User's vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { myAwesomePlugin } from 'my-awesome-edges/plugin';

export default defineConfig({
	plugins: [sveltekit(), myAwesomePlugin()]
});
```

**For package development/testing:**

```typescript
// vite.config.ts - when developing @azure-net/edges itself
import { createEdgesPluginFactory } from './src/lib/plugin/index.js';

const edgesPluginDev = createEdgesPluginFactory('@azure-net/edges', '$lib/server');

export default defineConfig({
	plugins: [sveltekit(), edgesPluginDev()]
});
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
