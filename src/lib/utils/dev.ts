import { browser, dev } from './environment.js';
import type { UnknownFunc } from '../types.js';

const seenFactories = new WeakSet<UnknownFunc>();
const largeStateWarnings = new Set<string>();
const sizeCache = new WeakMap<object, number>();

export const DevTools = {
	validateFactoryUniqueness(factory: UnknownFunc, key: string): void {
		if (!dev) return;

		if (seenFactories.has(factory)) {
			console.warn(
				`[edges-svelte] Factory collision detected for key "${key}". ` +
					`This might cause unexpected behavior. Consider using createNamedStore() ` +
					`or setting a unique __storeKey__ property on your factory function.`
			);
		}
		seenFactories.add(factory);
	},

	getSize(value: unknown): number {
		if (typeof value === 'object' && value !== null) {
			if (sizeCache.has(value)) {
				return sizeCache.get(value)!;
			}
			const size = JSON.stringify(value).length;
			sizeCache.set(value, size);
			return size;
		}
		return JSON.stringify(value).length;
	},

	warnOnLargeState(key: string, value: unknown): void {
		if (!dev) return;
		if (largeStateWarnings.has(key)) return;

		try {
			const size = this.getSize(value);
			if (size > 50000) {
				largeStateWarnings.add(key);
				console.warn(
					`[edges-svelte] Large state detected for key "${key}" (${Math.round(size / 1024)}KB). ` +
						`Consider splitting into smaller stores or enabling compression.`
				);
			}
		} catch {
			// Ignore serialization errors in dev warnings
		}
	},

	checkStateMutation(key: string, oldValue: unknown, newValue: unknown): void {
		if (!dev || !browser) return;

		// Check for direct object mutations
		if (typeof oldValue === 'object' && oldValue !== null && oldValue === newValue && !Array.isArray(oldValue)) {
			console.error(
				`[edges-svelte] Direct mutation detected for key "${key}". ` +
					`State should be immutable. Use spread operator or Object.assign() to create new objects.`
			);
		}
	},

	measurePerformance<T>(name: string, fn: () => T): T {
		if (!dev) return fn();

		const start = performance.now();
		const result = fn();
		const duration = performance.now() - start;

		if (duration > 16) {
			console.warn(`[edges-svelte] Slow operation "${name}" took ${duration.toFixed(2)}ms. ` + `Consider optimizing for better performance.`);
		}

		return result;
	},

	visualizeStateTree(stateMap: Map<string, unknown>): void {
		if (!dev || !browser) return;

		const tree: Record<string, unknown> = {};
		for (const [key, value] of stateMap) {
			const parts = key.split('::');
			let current = tree;

			for (let i = 0; i < parts.length - 1; i++) {
				if (!current[parts[i]]) {
					current[parts[i]] = {};
				}
				current = current[parts[i]] as Record<string, unknown>;
			}

			current[parts[parts.length - 1]] = value;
		}

		console.groupCollapsed('[edges-svelte] State Tree');
		console.dir(tree, { depth: null });
		console.groupEnd();
	}
};

if (browser && dev) {
	window.__EDGES_DEVTOOLS__ = {
		version: '1.3.0',
		visualizeState: () => {
			const stateMap = window.__SAFE_SSR_STATE__;
			if (stateMap) {
				DevTools.visualizeStateTree(stateMap);
			}
		},
		clearCache: () => {
			window.__SAFE_SSR_STATE__?.clear();
			console.log('[edges-svelte] Cache cleared');
		},
		getStats: () => {
			const stateMap = window.__SAFE_SSR_STATE__;
			if (!stateMap) return null;

			let totalSize = 0;
			const sizes: Record<string, number> = {};

			for (const [key, value] of stateMap) {
				try {
					const size = DevTools.getSize(value);
					sizes[key] = size;
					totalSize += size;
				} catch {
					sizes[key] = 0;
				}
			}

			return {
				totalStores: stateMap.size,
				totalSize: `${Math.round(totalSize / 1024)}KB`,
				storeSizes: sizes
			};
		}
	};

	console.log('%c[edges-svelte] DevTools enabled. Use window.__EDGES_DEVTOOLS__ for debugging.', 'color: #00bcd4; font-weight: bold');
}
