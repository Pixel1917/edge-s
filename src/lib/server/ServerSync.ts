import { getStateMap } from '../store/State.svelte.js';
import { RequestContext } from '../context/Context.js';
import { build, dev } from '../utils/environment.js';

const UNDEFINED_MARKER = '__EDGES_UNDEFINED__';
const NULL_MARKER = '__EDGES_NULL__';
const BIGINT_MARKER = '__EDGES_BIGINT__';

const EDGES_STATE_FIELD = '__edges_state__';
const EDGES_REV_FIELD = '__edges_rev__';

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const PROFILE_EDGES_DELTA = dev && !build;

const encodeEdgesValue = (value: unknown): unknown => {
	if (value === undefined) return { [UNDEFINED_MARKER]: true };
	if (value === null) return { [NULL_MARKER]: true };
	if (typeof value === 'bigint') return { [BIGINT_MARKER]: value.toString() };
	if (Array.isArray(value)) {
		return value.map((item) => encodeEdgesValue(item));
	}
	if (typeof value === 'object' && value !== null) {
		const encoded: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
			encoded[key] = encodeEdgesValue(nested);
		}
		return encoded;
	}
	return value;
};

const getEdgesDelta = (): { state: Record<string, unknown>; rev: string } | undefined => {
	const startedAt = PROFILE_EDGES_DELTA ? performance.now() : 0;
	try {
		const context = RequestContext.current();
		const dirtyKeys = context.data.edgesDirtyKeys;
		const rev = context.data.edgesRevision;
		const stateMap = getStateMap();

		if (!dirtyKeys || dirtyKeys.size === 0 || !stateMap || stateMap.size === 0) return undefined;

		const state: Record<string, unknown> = {};
		for (const key of dirtyKeys) {
			if (!stateMap.has(key)) continue;
			state[key] = encodeEdgesValue(stateMap.get(key));
		}

		if (!rev || Object.keys(state).length === 0) return undefined;
		return { state, rev };
	} catch {
		return undefined;
	} finally {
		if (PROFILE_EDGES_DELTA) {
			const duration = performance.now() - startedAt;
			if (duration > 4) {
				console.debug(`[edges-svelte] edges delta encode took ${duration.toFixed(2)}ms`);
			}
		}
	}
};

const mergePayloadWithEdges = (payload: unknown): unknown => {
	const edges = getEdgesDelta();
	if (!edges) return payload;

	if (isObjectRecord(payload)) {
		return {
			...payload,
			[EDGES_STATE_FIELD]: edges.state,
			[EDGES_REV_FIELD]: edges.rev
		};
	}

	if (payload === undefined) {
		return {
			[EDGES_STATE_FIELD]: edges.state,
			[EDGES_REV_FIELD]: edges.rev
		};
	}

	return payload;
};

export const __withEdgesServerLoad = <T extends (...args: unknown[]) => unknown>(load: T): T => {
	const wrapped = (async (...args: Parameters<T>) => {
		const result = await load(...args);
		return mergePayloadWithEdges(result);
	}) as T;
	return wrapped;
};

export const __withEdgesActions = <T extends Record<string, (...args: unknown[]) => unknown>>(actions: T): T => {
	const wrapped: Record<string, (...args: unknown[]) => unknown> = {};
	for (const [name, action] of Object.entries(actions)) {
		wrapped[name] = async (...args: unknown[]) => {
			const result = await action(...args);
			return mergePayloadWithEdges(result);
		};
	}
	return wrapped as T;
};

export const __withEdgesUniversalLoad = <T extends (...args: unknown[]) => unknown>(load: T): T => {
	const wrapped = (async (...args: Parameters<T>) => {
		const event = args[0] as { data?: unknown } | undefined;
		const result = await load(...args);
		if (!isObjectRecord(event?.data)) return result;
		const inheritedState = event.data[EDGES_STATE_FIELD];
		const inheritedRev = event.data[EDGES_REV_FIELD];
		if (!inheritedState) return result;

		if (isObjectRecord(result)) {
			return {
				...result,
				[EDGES_STATE_FIELD]: inheritedState,
				[EDGES_REV_FIELD]: inheritedRev
			};
		}

		if (result === undefined) {
			return {
				[EDGES_STATE_FIELD]: inheritedState,
				[EDGES_REV_FIELD]: inheritedRev
			};
		}

		return result;
	}) as T;
	return wrapped;
};
