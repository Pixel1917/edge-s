# Advanced edges-svelte Usage

## 🛡️ Minification-safe stores

### Method 1: Pass key as first argument (NEW! Recommended) ✨

```typescript
// Super clean - just pass the key as first argument!
export const useUserStore = createStore('user-store', ({ createState, createRawState }) => {
  const user = createRawState<User | null>(null);
  const isLoggedIn = createState(false);

  return { user, isLoggedIn };
});

// Same for presenters
export const useAuthPresenter = createPresenter('auth-presenter', () => {
  const login = async (credentials) => { ... };
  const logout = () => { ... };

  return { login, logout };
});
```

### Method 2: Use **storeKey** property (backwards compatible)

```typescript
// Define store with explicit key for production builds
const userStoreFactory = ({ createState, createRawState }) => {
	const user = createRawState<User | null>(null);
	const isLoggedIn = createState(false);

	return { user, isLoggedIn };
};

// Add explicit key to avoid minification issues
userStoreFactory.__storeKey__ = 'userStore';
// Or use displayName for debugging
userStoreFactory.displayName = 'UserStore';

export const useUserStore = createStore(userStoreFactory);
```

### Method 3: Auto-generate (for non-critical stores)

```typescript
// Let the system generate a key - fine for simple stores
export const uiStore = createStore(({ createState }) => {
	const theme = createState('light');
	const sidebarOpen = createState(false);

	return { theme, sidebarOpen };
});
```

## 🚀 Performance Patterns

### 1. Lazy Store Initialization

```typescript
// Stores are only created when accessed
const useHeavyStore = createStore(({ createState }) => {
	// This only runs when useHeavyStore() is called
	const data = createState(() => expensiveComputation());
	return { data };
});
```

### 2. Optimized Derived States

```typescript
const useMetricsStore = createStore(({ createState, createDerivedState }) => {
	const items = createState<Item[]>([]);

	// Derived states are cached and only update when dependencies change
	const totalPrice = createDerivedState([items], ([$items]) => $items.reduce((sum, item) => sum + item.price, 0));

	const averagePrice = createDerivedState([totalPrice, items], ([$total, $items]) => ($items.length ? $total / $items.length : 0));

	return { items, totalPrice, averagePrice };
});
```

### 3. Raw State for Frequent Updates

```typescript
// Use raw state for values that update frequently
const useRealtimeStore = createStore(({ createRawState }) => {
	// Raw state doesn't trigger Svelte reactivity on every change
	const mousePosition = createRawState({ x: 0, y: 0 });
	const fps = createRawState(60);

	return { mousePosition, fps };
});
```

## 🎨 Complete Example

```typescript
// stores/app.store.ts
import { createStore, batch } from 'edges-svelte';
import type { User, Settings } from '$lib/types';

const appStoreFactory = ({ createState, createRawState, createDerivedState }) => {
	// User state
	const user = createRawState<User | null>(null);
	const isAuthenticated = createDerivedState([user], ([u]) => u !== null);

	// Settings with compression for large objects
	const settings = createState<Settings>(() => ({
		theme: 'light',
		notifications: true
		// Large configuration object...
	}));

	// Actions with batching
	const login = async (credentials: Credentials) => {
		const userData = await api.login(credentials);

		batch(() => {
			user.value = userData;
			settings.update((s) => ({ ...s, ...userData.settings }));
		});

		return userData;
	};

	const logout = () => {
		batch(() => {
			user.value = null;
			settings.set(defaultSettings);
		});
	};

	return {
		// State
		user,
		isAuthenticated,
		settings,

		// Actions
		login,
		logout
	};
};

// Add minification-safe key
appStoreFactory.__storeKey__ = 'appStore';

export const useAppStore = createStore(appStoreFactory);
```

## 🎉 That's it!

Your edges-svelte setup is now production-ready with:

- ✅ Minification-safe key generation
- ✅ DevTools for debugging
- ✅ Batched updates for performance
- ✅ Optional state compression
- ✅ Full TypeScript support

Enjoy the 10/10 DX! 🚀
