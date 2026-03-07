import type { Writable, Readable } from 'svelte/store';

export interface StoreConfig {
	__storeKey__?: string;
	displayName?: string;
}

export type StoreFactory<T, I = Record<string, unknown>> = ((
	args: {
		createState: <T>(initial: T | (() => T)) => Writable<T>;
		createRawState: <T>(initial: T | (() => T)) => { value: T };
		createDerivedState: <T extends Readable<unknown>[], D>(stores: T, deriveFn: (values: unknown[]) => D) => Readable<D>;
	} & I
) => T) &
	StoreConfig;

export type PresenterFactory<T, I = Record<string, unknown>> = ((args: I) => T) & StoreConfig;

export interface BatchOptions {
	defer?: boolean;
	onComplete?: () => void;
}

export interface CompressionOptions {
	enabled?: boolean;
	threshold?: number;
	algorithm?: 'base64' | 'gzip' | 'brotli';
}

export interface DevToolsConfig {
	enabled?: boolean;
	warnLargeState?: boolean;
	largeStateThreshold?: number;
	checkMutations?: boolean;
	logPerformance?: boolean;
}

export interface EdgesConfig {
	devTools?: DevToolsConfig;
	compression?: CompressionOptions;
	batch?: BatchOptions;
}

export type UnknownFunc = { (...args: unknown[]): unknown; __storeKey__: string; displayName: string };
