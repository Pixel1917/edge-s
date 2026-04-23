<script lang="ts">
	import { onMount } from 'svelte';
	import type { DevToolsInspectorSnapshot, DevToolsKeyCheckResult, EdgesDevtoolsWindowApi } from './dev.js';

	type Tab = 'presenters' | 'stores' | 'info';

	const emptySnapshot = (): DevToolsInspectorSnapshot => ({
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

	let isOpen = false;
	let activeTab: Tab = 'presenters';
	let inspector: DevToolsInspectorSnapshot = emptySnapshot();
	let keyCheckResult: DevToolsKeyCheckResult | null = null;
	let presenterExpanded = new Set<string>();
	let storeExpanded = new Set<string>();

	const toKb = (value: number) => `${(value / 1024).toFixed(2)} KB`;
	const toDateTime = (ts: number | null) => (ts ? new Date(ts).toLocaleTimeString() : 'never');

	const refresh = () => {
		const api = window.__EDGES_DEVTOOLS__ as EdgesDevtoolsWindowApi | undefined;
		inspector = api?.getInspectorData?.() ?? emptySnapshot();
	};

	const toggleExpanded = (target: Set<string>, key: string) => {
		const next = new Set(target);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	};

	const runKeyCheck = () => {
		const api = window.__EDGES_DEVTOOLS__ as EdgesDevtoolsWindowApi | undefined;
		keyCheckResult = api?.checkKeyUniqueness?.() ?? null;
	};

	const clearStateCache = () => {
		const api = window.__EDGES_DEVTOOLS__ as EdgesDevtoolsWindowApi | undefined;
		api?.clearCache?.();
		refresh();
	};

	onMount(() => {
		refresh();
		const interval = window.setInterval(() => {
			if (isOpen) refresh();
		}, 1500);
		return () => window.clearInterval(interval);
	});
</script>

<div class="edges-devtools">
	<button class="launcher" on:click={() => (isOpen = !isOpen)} aria-label="Toggle edges devtools"> DEV </button>

	{#if isOpen}
		<div class="panel">
			<div class="tabs">
				<button class:active={activeTab === 'presenters'} on:click={() => (activeTab = 'presenters')}
					>presenters ({inspector.presenters.length})</button
				>
				<button class:active={activeTab === 'stores'} on:click={() => (activeTab = 'stores')}>stores ({inspector.stores.length})</button>
				<button class:active={activeTab === 'info'} on:click={() => (activeTab = 'info')}>info</button>
			</div>

			<div class="content">
				{#if activeTab === 'presenters'}
					{#if inspector.presenters.length === 0}
						<div class="empty">No presenters registered yet.</div>
					{:else}
						{#each inspector.presenters as presenter (presenter)}
							<div class="accordion-item">
								<button class="accordion-head" on:click={() => (presenterExpanded = toggleExpanded(presenterExpanded, presenter.key))}>
									<span>{presenter.key}</span>
									<span>{presenterExpanded.has(presenter.key) ? '−' : '+'}</span>
								</button>
								{#if presenterExpanded.has(presenter.key)}
									<div class="accordion-body">
										<div><strong>Factory:</strong> {presenter.factoryName}</div>
										<div><strong>Named key:</strong> {presenter.named ? 'yes' : 'no (auto-generated)'}</div>
										<div><strong>Instantiated:</strong> {presenter.instantiated ? 'yes' : 'no'}</div>
										<div><strong>Hits:</strong> {presenter.hits}</div>
										<div><strong>Instance size:</strong> {toKb(presenter.instanceSizeBytes)}</div>
										<div><strong>Last access:</strong> {toDateTime(presenter.lastAccessedAt)}</div>
										<div><strong>Registered:</strong> {toDateTime(presenter.registeredAt)}</div>
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				{/if}

				{#if activeTab === 'stores'}
					{#if inspector.stores.length === 0}
						<div class="empty">No stores registered yet.</div>
					{:else}
						{#each inspector.stores as store (store)}
							<div class="accordion-item">
								<button class="accordion-head" on:click={() => (storeExpanded = toggleExpanded(storeExpanded, store.key))}>
									<span>{store.key}</span>
									<span>{storeExpanded.has(store.key) ? '−' : '+'}</span>
								</button>
								{#if storeExpanded.has(store.key)}
									<div class="accordion-body">
										<div><strong>Factory:</strong> {store.factoryName}</div>
										<div><strong>Named key:</strong> {store.named ? 'yes' : 'no (auto-generated)'}</div>
										<div><strong>States:</strong> {store.stateCount}</div>
										<div><strong>Total state size:</strong> {toKb(store.stateSizeBytes)}</div>
										<div><strong>Instance size:</strong> {toKb(store.instanceSizeBytes)}</div>
										<div><strong>Last access:</strong> {toDateTime(store.lastAccessedAt)}</div>
										<div class="state-tree-title">State tree</div>
										{#if store.states.length === 0}
											<div class="empty tiny">No state entries found for this store.</div>
										{:else}
											<div class="state-tree">
												{#each store.states as stateEntry (stateEntry)}
													<div class="state-entry">
														<div><strong>{stateEntry.fullKey}</strong></div>
														<div>slot: {stateEntry.slot}{stateEntry.index !== null ? ` #${stateEntry.index}` : ''}</div>
														<div>size: {toKb(stateEntry.sizeBytes)}</div>
														<div class="preview">value: {stateEntry.valuePreview}</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				{/if}

				{#if activeTab === 'info'}
					<div class="info-actions">
						<button on:click={refresh}>Refresh snapshot</button>
						<button on:click={clearStateCache}>Clear state cache</button>
					</div>
					<div class="metrics">
						<div><strong>Total providers:</strong> {inspector.info.totalProviders}</div>
						<div><strong>Presenters:</strong> {inspector.info.totalPresenters}</div>
						<div><strong>Stores:</strong> {inspector.info.totalStores}</div>
						<div><strong>Instantiated providers:</strong> {inspector.info.instantiatedProviders}</div>
						<div><strong>Total state entries:</strong> {inspector.info.totalStateEntries}</div>
						<div><strong>Total state size:</strong> {toKb(inspector.info.totalStateSizeBytes)}</div>
						<div><strong>Provider cache entries:</strong> {inspector.info.providerCacheEntries}</div>
						<div><strong>Provider cache size:</strong> {toKb(inspector.info.providerCacheSizeBytes)}</div>
					</div>

					{#if keyCheckResult}
						<div class="key-check {keyCheckResult.ok ? 'ok' : 'warn'}">
							<div><strong>Key check:</strong> {keyCheckResult.ok ? 'OK' : 'Issues found'}</div>
							<div><strong>Provider keys checked:</strong> {keyCheckResult.providerKeysChecked}</div>
							{#if keyCheckResult.duplicateAttempts.length > 0}
								<div class="duplicate-list">
									{#each keyCheckResult.duplicateAttempts as duplicate (duplicate)}
										<div>
											{duplicate.key}: attempted {duplicate.attemptedKind}, existing {duplicate.existingKind} ({toDateTime(duplicate.at)})
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.edges-devtools {
		position: fixed;
		right: 20px;
		bottom: 20px;
		z-index: 999999;
		font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
	}

	.launcher {
		width: 50px;
		height: 50px;
		border-radius: 999px;
		border: none;
		background: linear-gradient(140deg, #0f766e, #155e75);
		color: #f8fafc;
		font-weight: 700;
		letter-spacing: 0.04em;
		cursor: pointer;
		box-shadow: 0 8px 18px rgba(15, 118, 110, 0.45);
	}

	.panel {
		position: absolute;
		right: 0;
		bottom: 62px;
		width: min(760px, calc(100vw - 32px));
		height: min(520px, calc(100vh - 96px));
		display: grid;
		grid-template-columns: 180px 1fr;
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
	}

	.tabs {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px;
		background: #e2e8f0;
		border-right: 1px solid #cbd5e1;
	}

	.tabs button {
		text-align: left;
		border: 1px solid #94a3b8;
		background: #f8fafc;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		text-transform: lowercase;
	}

	.tabs button.active {
		background: #0f766e;
		color: #f8fafc;
		border-color: #0f766e;
	}

	.content {
		padding: 12px;
		overflow: auto;
		font-size: 12px;
		color: #0f172a;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
	}

	.accordion-item {
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.accordion-head {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 10px;
		font-weight: 700;
		background: #f1f5f9;
		border: none;
		cursor: pointer;
	}

	.accordion-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px;
		background: #ffffff;
		max-height: 240px;
		overflow: auto;
		min-height: 0;
	}

	.state-tree-title {
		margin-top: 6px;
		font-weight: 700;
	}

	.state-tree {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 180px;
		overflow: auto;
		padding-right: 2px;
	}

	.state-entry {
		border: 1px solid #dbeafe;
		background: #f8fbff;
		border-radius: 8px;
		padding: 7px;
	}

	.preview {
		font-family: 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, monospace;
		word-break: break-word;
	}

	.empty {
		padding: 12px;
		border: 1px dashed #94a3b8;
		border-radius: 8px;
		color: #475569;
	}

	.tiny {
		padding: 6px;
	}

	.info-actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.info-actions button {
		border: 1px solid #64748b;
		background: #ffffff;
		padding: 6px 8px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 12px;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
		padding: 8px;
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
	}

	.key-check {
		padding: 8px;
		border-radius: 8px;
		border: 1px solid;
	}

	.key-check.ok {
		border-color: #16a34a;
		background: #f0fdf4;
	}

	.key-check.warn {
		border-color: #dc2626;
		background: #fef2f2;
	}

	.duplicate-list {
		margin-top: 6px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	@media (max-width: 760px) {
		.panel {
			grid-template-columns: 1fr;
			height: min(78vh, 560px);
		}

		.tabs {
			flex-direction: row;
			padding: 8px;
			border-right: none;
			border-bottom: 1px solid #cbd5e1;
			overflow-x: auto;
		}
	}
</style>
