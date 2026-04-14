import { browser } from './environment.js';

interface BatchUpdate {
	key: string;
	value: unknown;
	callback?: (value: unknown) => void;
}

class BatchManager {
	private pendingUpdates = new Map<string, BatchUpdate>();
	private depth = 0;
	private batchCallbacks = new Set<() => void>();

	batch(fn: () => void): void {
		if (!browser) {
			fn();
			return;
		}

		this.depth += 1;

		try {
			fn();
		} finally {
			this.depth -= 1;
			if (this.depth === 0) {
				this.flush();
			}
		}
	}

	begin(): void {
		if (!browser) return;
		this.depth += 1;
	}

	end(): void {
		if (!browser) return;
		if (this.depth === 0) return;
		this.depth -= 1;
		if (this.depth === 0) {
			this.flush();
		}
	}

	isBatching(): boolean {
		return browser && this.depth > 0;
	}

	queueUpdate(key: string, value: unknown, callback?: (value: unknown) => void): void {
		if (!browser || this.depth === 0) {
			if (callback) callback(value);
			return;
		}

		this.pendingUpdates.set(key, { key, value, callback });
	}

	onBatchComplete(callback: () => void): void {
		this.batchCallbacks.add(callback);
	}

	private flush(): void {
		if (this.pendingUpdates.size === 0) {
			return;
		}

		queueMicrotask(() => {
			const updates = Array.from(this.pendingUpdates.values());
			this.pendingUpdates.clear();

			for (const update of updates) {
				if (update.callback) {
					update.callback(update.value);
				}
			}

			for (const callback of this.batchCallbacks) {
				callback();
			}
			this.batchCallbacks.clear();
		});
	}
}

const batchManager = new BatchManager();

export const batch = (fn: () => void) => batchManager.batch(fn);

export const queueUpdate = (key: string, value: unknown, callback?: (value: unknown) => void) => batchManager.queueUpdate(key, value, callback);

export const onBatchComplete = (callback: () => void) => batchManager.onBatchComplete(callback);

export const isBatching = () => batchManager.isBatching();

export const transaction = async <T>(fn: () => Promise<T>): Promise<T> => {
	if (!browser) {
		return fn();
	}

	batchManager.begin();
	try {
		return await fn();
	} finally {
		batchManager.end();
	}
};
