import { browser } from '$app/environment';

interface BatchUpdate {
	key: string;
	value: unknown;
	callback?: (value: unknown) => void;
}

class BatchManager {
	private pendingUpdates = new Map<string, BatchUpdate>();
	private scheduled = false;
	private batchCallbacks = new Set<() => void>();

	/**
	 * Batch multiple state updates into a single render cycle
	 */
	batch(fn: () => void): void {
		if (!browser) {
			// On server, execute immediately
			fn();
			return;
		}

		// Collect all updates
		const startBatching = !this.scheduled;
		if (startBatching) {
			this.scheduled = true;
		}

		try {
			fn();
		} finally {
			if (startBatching) {
				this.flush();
			}
		}
	}

	/**
	 * Add an update to the batch queue
	 */
	queueUpdate(key: string, value: unknown, callback?: (value: unknown) => void): void {
		if (!browser || !this.scheduled) {
			// Execute immediately if not batching
			if (callback) callback(value);
			return;
		}

		this.pendingUpdates.set(key, { key, value, callback });
	}

	/**
	 * Register a callback to be called when batch completes
	 */
	onBatchComplete(callback: () => void): void {
		this.batchCallbacks.add(callback);
	}

	/**
	 * Flush all pending updates
	 */
	private flush(): void {
		if (this.pendingUpdates.size === 0) {
			this.scheduled = false;
			return;
		}

		// Use microtask to batch DOM updates
		queueMicrotask(() => {
			const updates = Array.from(this.pendingUpdates.values());
			this.pendingUpdates.clear();
			this.scheduled = false;

			// Apply all updates
			for (const update of updates) {
				if (update.callback) {
					update.callback(update.value);
				}
			}

			// Notify batch complete
			for (const callback of this.batchCallbacks) {
				callback();
			}
			this.batchCallbacks.clear();
		});
	}
}

// Global batch manager instance
const batchManager = new BatchManager();

/**
 * Batch multiple state updates to avoid unnecessary re-renders
 *
 * @example
 * ```ts
 * batch(() => {
 *   store1.set(value1);
 *   store2.set(value2);
 *   store3.set(value3);
 * });
 * ```
 */
export const batch = (fn: () => void) => batchManager.batch(fn);

/**
 * Queue an update for batching (internal use)
 */
export const queueUpdate = (key: string, value: unknown, callback?: (value: unknown) => void) => batchManager.queueUpdate(key, value, callback);

/**
 * Register a callback for batch completion (internal use)
 */
export const onBatchComplete = (callback: () => void) => batchManager.onBatchComplete(callback);

/**
 * Transaction-like API for complex state updates
 */
export const transaction = async <T>(fn: () => Promise<T>): Promise<T> => {
	return new Promise((resolve, reject) => {
		batch(() => {
			fn().then(resolve).catch(reject);
		});
	});
};
