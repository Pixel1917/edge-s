import { BROWSER, DEV } from '@azure-net/tools/environment';
import type { UnknownFunc } from '../types.js';

export type ProviderKind = 'store' | 'presenter';

export interface ProviderDevDefinitionSnapshot {
	key: string;
	kind: ProviderKind;
	factoryName: string;
	named: boolean;
	registeredAt: number;
}

export interface ProviderDevRuntimeSnapshot {
	key: string;
	instantiated: boolean;
	hits: number;
	lastAccessedAt: number | null;
	instanceSizeBytes: number;
}

export interface ProviderDevSnapshot {
	definitions: ProviderDevDefinitionSnapshot[];
	runtimes: ProviderDevRuntimeSnapshot[];
	providerCacheEntries: number;
	providerCacheSizeBytes: number;
}

export interface ProviderDuplicateAttempt {
	key: string;
	attemptedKind: ProviderKind;
	existingKind: ProviderKind;
	at: number;
}

const providerDefinitions = new Map<string, ProviderDevDefinitionSnapshot>();
const providerRuntime = new Map<string, ProviderDevRuntimeSnapshot>();

let providerCacheEntries = 0;
let providerCacheSizeBytes = 0;

const safeJsonLength = (value: unknown): number => {
	try {
		const serialized = JSON.stringify(value);
		return serialized ? serialized.length : 0;
	} catch {
		return 0;
	}
};

const estimateSize = (value: unknown): number => {
	if (typeof value === 'bigint') return value.toString().length;
	if (typeof value === 'function' || typeof value === 'symbol') return 0;
	if (typeof value === 'string') return value.length;
	if (value === undefined || value === null) return 0;
	return safeJsonLength(value);
};

export const trackFactoryUniqueness = (factory: UnknownFunc, key: string): void => {
	factory;
	key;
};

export const validateNamedProviderUniqueness = (key: string, kind: ProviderKind, factory: UnknownFunc): void => {
	key;
	kind;
	factory;
};

export const registerProviderDefinition = (key: string, kind: ProviderKind, factory: UnknownFunc, named: boolean): void => {
	if (!DEV || !BROWSER) return;
	if (providerDefinitions.has(key)) return;
	providerDefinitions.set(key, {
		key,
		kind,
		factoryName: factory.displayName || factory.name || '(anonymous)',
		named,
		registeredAt: Date.now()
	});
};

export const recordProviderAccess = (key: string, instance: unknown, cacheEntriesHint?: number): void => {
	if (!DEV || !BROWSER) return;
	const runtime = providerRuntime.get(key) ?? {
		key,
		instantiated: false,
		hits: 0,
		lastAccessedAt: null,
		instanceSizeBytes: 0
	};

	runtime.instantiated = true;
	runtime.hits += 1;
	runtime.lastAccessedAt = Date.now();
	runtime.instanceSizeBytes = estimateSize(instance);
	providerRuntime.set(key, runtime);

	if (typeof cacheEntriesHint === 'number') {
		providerCacheEntries = cacheEntriesHint;
	}

	providerCacheSizeBytes = 0;
	for (const [providerKey, tracked] of providerRuntime) {
		providerCacheSizeBytes += providerKey.length;
		providerCacheSizeBytes += tracked.instanceSizeBytes;
	}
};

export const getProviderDevSnapshot = (): ProviderDevSnapshot => ({
	definitions: Array.from(providerDefinitions.values()),
	runtimes: Array.from(providerRuntime.values()),
	providerCacheEntries,
	providerCacheSizeBytes
});

export const getProviderDuplicateAttempts = (): ProviderDuplicateAttempt[] => [];
