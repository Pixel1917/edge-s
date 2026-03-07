import { browser } from './environment.js';

interface BatchUpdate {
	key: string;
	value: unknown;
	callback?: (value: unknown) => void;
}

class BatchManager {
	private pendingUpdates = new Map<string, BatchUpdate>();
	private scheduled = false;
	private batchCallbacks = new Set<() => void>();

	batch(fn: () => void): void {
		if (!browser) {
			fn();
			return;
		}

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

	queueUpdate(key: string, value: unknown, callback?: (value: unknown) => void): void {
		if (!browser || !this.scheduled) {
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
			this.scheduled = false;
			return;
		}

		queueMicrotask(() => {
			const updates = Array.from(this.pendingUpdates.values());
			this.pendingUpdates.clear();
			this.scheduled = false;

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

export const transaction = async <T>(fn: () => Promise<T>): Promise<T> => {
	return new Promise((resolve, reject) => {
		batch(() => {
			fn().then(resolve).catch(reject);
		});
	});
};
