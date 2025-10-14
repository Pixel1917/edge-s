import type { Writable, Readable } from 'svelte/store';

/**
 * Configuration for store creation with minification resistance
 */
export interface StoreConfig {
	/**
	 * Explicit key for the store to avoid minification issues
	 * @example
	 * ```ts
	 * const factory = (deps) => { ... };
	 * factory.__storeKey__ = 'userStore';
	 * ```
	 */
	__storeKey__?: string;

	/**
	 * Display name for debugging
	 */
	displayName?: string;
}

/**
 * Store factory function with configuration
 */
export type StoreFactory<T, I = Record<string, unknown>> = ((
	args: {
		createState: <T>(initial: T | (() => T)) => Writable<T>;
		createRawState: <T>(initial: T | (() => T)) => { value: T };
		createDerivedState: <T extends Readable<unknown>[], D>(stores: T, deriveFn: (values: unknown[]) => D) => Readable<D>;
	} & I
) => T) &
	StoreConfig;

/**
 * Presenter factory function with configuration
 */
export type PresenterFactory<T, I = Record<string, unknown>> = ((args: I) => T) & StoreConfig;

/**
 * Options for batched state updates
 */
export interface BatchOptions {
	/**
	 * Whether to defer DOM updates to the next microtask
	 * @default true
	 */
	defer?: boolean;

	/**
	 * Callback when batch completes
	 */
	onComplete?: () => void;
}

/**
 * Compression options for state serialization
 */
export interface CompressionOptions {
	/**
	 * Enable compression for large state objects
	 * @default false
	 */
	enabled?: boolean;

	/**
	 * Minimum size in bytes before compression is applied
	 * @default 1024 (1KB)
	 */
	threshold?: number;

	/**
	 * Compression algorithm to use
	 * @default 'base64'
	 */
	algorithm?: 'base64' | 'gzip' | 'brotli';
}

/**
 * Development tools configuration
 */
export interface DevToolsConfig {
	/**
	 * Enable development mode validations
	 * @default true in dev, false in production
	 */
	enabled?: boolean;

	/**
	 * Warn about large state objects
	 * @default true
	 */
	warnLargeState?: boolean;

	/**
	 * Size threshold for large state warnings (in bytes)
	 * @default 50000 (50KB)
	 */
	largeStateThreshold?: number;

	/**
	 * Check for direct state mutations
	 * @default true
	 */
	checkMutations?: boolean;

	/**
	 * Log performance metrics
	 * @default false
	 */
	logPerformance?: boolean;
}

/**
 * Global configuration for edges-svelte
 */
export interface EdgesConfig {
	/**
	 * Development tools configuration
	 */
	devTools?: DevToolsConfig;

	/**
	 * Default compression options for state serialization
	 */
	compression?: CompressionOptions;

	/**
	 * Default batch options
	 */
	batch?: BatchOptions;
}

export type UnknownFunc = { (...args: unknown[]): unknown; __storeKey__: string; displayName: string };
