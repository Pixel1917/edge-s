import { BROWSER, DEV } from '@azure-net/tools/environment';

import {
	getProviderDevSnapshot,
	getProviderDuplicateAttempts,
	type ProviderKind,
	type ProviderDevDefinitionSnapshot,
	type ProviderDevRuntimeSnapshot
} from '../provider/Utils.js';

export interface DevToolsStateEntrySnapshot {
	fullKey: string;
	slot: 'state' | 'rawstate' | 'unknown';
	index: number | null;
	sizeBytes: number;
	valuePreview: string;
}

export interface DevToolsProviderSnapshot {
	key: string;
	kind: ProviderKind;
	factoryName: string;
	named: boolean;
	registeredAt: number;
	instantiated: boolean;
	hits: number;
	lastAccessedAt: number | null;
	instanceSizeBytes: number;
	stateCount: number;
	stateSizeBytes: number;
	states: DevToolsStateEntrySnapshot[];
}

export interface DevToolsInfoSnapshot {
	totalPresenters: number;
	totalStores: number;
	totalProviders: number;
	instantiatedProviders: number;
	totalStateEntries: number;
	totalStateSizeBytes: number;
	providerCacheEntries: number;
	providerCacheSizeBytes: number;
}

export interface DevToolsInspectorSnapshot {
	presenters: DevToolsProviderSnapshot[];
	stores: DevToolsProviderSnapshot[];
	info: DevToolsInfoSnapshot;
}

export interface DevToolsKeyCheckResult {
	ok: boolean;
	providerKeysChecked: number;
	duplicateAttempts: Array<{ key: string; attemptedKind: ProviderKind; existingKind: ProviderKind; at: number }>;
}

export interface EdgesDevtoolsWindowApi {
	version: string;
	visualizeState: () => void;
	clearCache: () => void;
	getStats: () => { totalStores: number; totalSize: string; storeSizes: Record<string, number> } | null;
	getInspectorData: () => DevToolsInspectorSnapshot;
	checkKeyUniqueness: () => DevToolsKeyCheckResult;
}

const largeStateWarnings = new Set<string>();
const sizeCache = new WeakMap<object, number>();

const safeJsonLength = (value: unknown): number => {
	const serialized = JSON.stringify(value);
	return serialized ? serialized.length : 0;
};

const parseStateKey = (fullKey: string): { providerKey: string; slot: 'state' | 'rawstate' | 'unknown'; index: number | null } => {
	const stateSeparator = '::state::';
	const rawStateSeparator = '::rawstate::';

	const stateIdx = fullKey.lastIndexOf(stateSeparator);
	if (stateIdx !== -1) {
		const providerKey = fullKey.slice(0, stateIdx);
		const indexRaw = fullKey.slice(stateIdx + stateSeparator.length);
		const index = Number(indexRaw);
		return { providerKey, slot: 'state', index: Number.isFinite(index) ? index : null };
	}

	const rawStateIdx = fullKey.lastIndexOf(rawStateSeparator);
	if (rawStateIdx !== -1) {
		const providerKey = fullKey.slice(0, rawStateIdx);
		const indexRaw = fullKey.slice(rawStateIdx + rawStateSeparator.length);
		const index = Number(indexRaw);
		return { providerKey, slot: 'rawstate', index: Number.isFinite(index) ? index : null };
	}

	return { providerKey: fullKey, slot: 'unknown', index: null };
};

const previewValue = (value: unknown): string => {
	if (typeof value === 'string') {
		return value.length > 160 ? `${value.slice(0, 157)}...` : value;
	}
	if (typeof value === 'bigint') {
		return `${value.toString()}n`;
	}
	if (typeof value === 'function') {
		return '[Function]';
	}
	if (typeof value === 'symbol') {
		return value.toString();
	}
	try {
		const serialized = JSON.stringify(value);
		if (!serialized) return String(value);
		return serialized.length > 160 ? `${serialized.slice(0, 157)}...` : serialized;
	} catch {
		return Object.prototype.toString.call(value);
	}
};

const getStoreStateEntries = (stateMap: Map<string, unknown>) => {
	const grouped = new Map<string, DevToolsStateEntrySnapshot[]>();

	for (const [fullKey, value] of stateMap) {
		const parsed = parseStateKey(fullKey);
		const entry: DevToolsStateEntrySnapshot = {
			fullKey,
			slot: parsed.slot,
			index: parsed.index,
			sizeBytes: DevTools.getSize(value),
			valuePreview: previewValue(value)
		};

		const existing = grouped.get(parsed.providerKey);
		if (existing) {
			existing.push(entry);
		} else {
			grouped.set(parsed.providerKey, [entry]);
		}
	}

	for (const entries of grouped.values()) {
		entries.sort((a, b) => {
			if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);
			if (a.index === null && b.index === null) return a.fullKey.localeCompare(b.fullKey);
			if (a.index === null) return 1;
			if (b.index === null) return -1;
			return a.index - b.index;
		});
	}

	return grouped;
};

const buildProviderSnapshot = (
	def: ProviderDevDefinitionSnapshot,
	runtime: ProviderDevRuntimeSnapshot | undefined,
	stateEntries: Map<string, DevToolsStateEntrySnapshot[]>
): DevToolsProviderSnapshot => {
	const states = stateEntries.get(def.key) ?? [];
	const stateSizeBytes = states.reduce((sum, entry) => sum + entry.sizeBytes, 0);
	return {
		key: def.key,
		kind: def.kind,
		factoryName: def.factoryName,
		named: def.named,
		registeredAt: def.registeredAt,
		instantiated: runtime?.instantiated ?? false,
		hits: runtime?.hits ?? 0,
		lastAccessedAt: runtime?.lastAccessedAt ?? null,
		instanceSizeBytes: runtime?.instanceSizeBytes ?? 0,
		stateCount: states.length,
		stateSizeBytes,
		states
	};
};

const emptyInspectorSnapshot = (): DevToolsInspectorSnapshot => ({
	presenters: [],
	stores: [],
	info: {
		totalPresenters: 0,
		totalStores: 0,
		totalProviders: 0,
		instantiatedProviders: 0,
		totalStateEntries: 0,
		totalStateSizeBytes: 0,
		providerCacheEntries: 0,
		providerCacheSizeBytes: 0
	}
});

export const DevTools = {
	getSize(value: unknown): number {
		if (typeof value === 'object' && value !== null) {
			if (sizeCache.has(value)) {
				return sizeCache.get(value)!;
			}
			const size = safeJsonLength(value);
			sizeCache.set(value, size);
			return size;
		}
		return safeJsonLength(value);
	},

	warnOnLargeState(key: string, value: unknown): void {
		if (!DEV) return;
		if (largeStateWarnings.has(key)) return;

		try {
			const size = this.getSize(value);
			if (size > 50000) {
				largeStateWarnings.add(key);
				console.warn(
					`[@azure-net/edges] Large state detected for key "${key}" (${Math.round(size / 1024)}KB). ` + `Consider splitting into smaller stores.`
				);
			}
		} catch {
			// Ignore serialization errors in dev warnings
		}
	},

	checkStateMutation(key: string, oldValue: unknown, newValue: unknown): void {
		if (!DEV || !BROWSER) return;

		if (typeof oldValue === 'object' && oldValue !== null && oldValue === newValue && !Array.isArray(oldValue)) {
			console.error(
				`[@azure-net/edges] Direct mutation detected for key "${key}". ` +
					`State should be immutable. Use spread operator or Object.assign() to create new objects.`
			);
		}
	},

	measurePerformance<T>(name: string, fn: () => T): T {
		if (!DEV) return fn();

		const start = performance.now();
		const result = fn();
		const duration = performance.now() - start;

		if (duration > 16) {
			console.warn(`[@azure-net/edges] Slow operation "${name}" took ${duration.toFixed(2)}ms. ` + `Consider optimizing for better performance.`);
		}

		return result;
	},

	visualizeStateTree(stateMap: Map<string, unknown>): void {
		if (!DEV || !BROWSER) return;

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

		console.groupCollapsed('[@azure-net/edges] State Tree');
		console.dir(tree, { depth: null });
		console.groupEnd();
	},

	getInspectorData(): DevToolsInspectorSnapshot {
		if (!BROWSER) return emptyInspectorSnapshot();
		const stateMap = window.__SAFE_SSR_STATE__ ?? new Map<string, unknown>();
		const groupedStateEntries = getStoreStateEntries(stateMap);
		const providerSnapshot = getProviderDevSnapshot();
		const runtimeByKey = new Map(providerSnapshot.runtimes.map((runtime) => [runtime.key, runtime]));
		const providerDefinitionKeys = new Set(providerSnapshot.definitions.map((def) => def.key));

		const snapshots: DevToolsProviderSnapshot[] = [];
		for (const def of providerSnapshot.definitions) {
			snapshots.push(buildProviderSnapshot(def, runtimeByKey.get(def.key), groupedStateEntries));
		}

		for (const [providerKey, states] of groupedStateEntries) {
			if (providerDefinitionKeys.has(providerKey)) continue;
			snapshots.push({
				key: providerKey,
				kind: 'store',
				factoryName: '(state-only)',
				named: false,
				registeredAt: 0,
				instantiated: false,
				hits: 0,
				lastAccessedAt: null,
				instanceSizeBytes: 0,
				stateCount: states.length,
				stateSizeBytes: states.reduce((sum, entry) => sum + entry.sizeBytes, 0),
				states
			});
		}

		snapshots.sort((a, b) => a.key.localeCompare(b.key));

		const presenters = snapshots.filter((entry) => entry.kind === 'presenter');
		const stores = snapshots.filter((entry) => entry.kind === 'store');
		const totalStateSizeBytes = stores.reduce((sum, store) => sum + store.stateSizeBytes, 0);
		const totalStateEntries = stores.reduce((sum, store) => sum + store.stateCount, 0);
		const instantiatedProviders = snapshots.filter((entry) => entry.instantiated).length;

		return {
			presenters,
			stores,
			info: {
				totalPresenters: presenters.length,
				totalStores: stores.length,
				totalProviders: snapshots.length,
				instantiatedProviders,
				totalStateEntries,
				totalStateSizeBytes,
				providerCacheEntries: providerSnapshot.providerCacheEntries,
				providerCacheSizeBytes: providerSnapshot.providerCacheSizeBytes
			}
		};
	},

	checkKeyUniqueness(): DevToolsKeyCheckResult {
		const duplicateAttempts = getProviderDuplicateAttempts();
		return {
			ok: duplicateAttempts.length === 0,
			providerKeysChecked: getProviderDevSnapshot().definitions.length,
			duplicateAttempts
		};
	}
};

declare global {
	interface Window {
		__SAFE_SSR_STATE__?: Map<string, unknown>;
		__EDGES_DEVTOOLS__?: Record<string, unknown>;
		__EDGES_DEVTOOLS_UI_MOUNTED__?: boolean;
	}
}

if (BROWSER && DEV) {
	const api: EdgesDevtoolsWindowApi = {
		version: '1.4.0',
		visualizeState: () => {
			const stateMap = window.__SAFE_SSR_STATE__;
			if (stateMap) {
				DevTools.visualizeStateTree(stateMap);
			}
		},
		clearCache: () => {
			window.__SAFE_SSR_STATE__?.clear();
			console.log('[@azure-net/edges] Cache cleared');
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
		},
		getInspectorData: () => DevTools.getInspectorData(),
		checkKeyUniqueness: () => DevTools.checkKeyUniqueness()
	};
	window.__EDGES_DEVTOOLS__ = api as unknown as Record<string, unknown>;

	if (!window.__EDGES_DEVTOOLS_UI_MOUNTED__) {
		window.__EDGES_DEVTOOLS_UI_MOUNTED__ = true;
		void Promise.all([import('svelte'), import('./DevTools.svelte')])
			.then(([svelte, module]) => {
				const target = document.body || document.documentElement;
				const host = document.createElement('div');
				host.setAttribute('data-edges-devtools-ui', '1');
				target.appendChild(host);
				svelte.mount(module.default, { target: host });
				window.addEventListener(
					'beforeunload',
					() => {
						host.remove();
						window.__EDGES_DEVTOOLS_UI_MOUNTED__ = false;
					},
					{ once: true }
				);
			})
			.catch(() => {
				window.__EDGES_DEVTOOLS_UI_MOUNTED__ = false;
			});
	}

	console.log('%c[@azure-net/edges] DevTools enabled. Use window.__EDGES_DEVTOOLS__ for debugging.', 'color: #00bcd4; font-weight: bold');
}
