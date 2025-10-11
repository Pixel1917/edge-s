import type { Handle } from '@sveltejs/kit';
import { edgesHandle } from './EdgesHandleSimplified.js';

/**
 * Automatically wraps a user-defined handle function with edgesHandle.
 * This is used internally by the Vite plugin to provide automatic state management.
 *
 * @internal This function is called automatically by the Vite plugin. You don't need to use it manually.
 *
 * @param userHandle - Optional user-defined handle function from hooks.server.ts
 * @returns A handle function wrapped with edgesHandle for automatic state serialization
 */
export function __autoWrapHandle(userHandle?: Handle): Handle {
	if (!userHandle) {
		// No user handle - return default edgesHandle
		return edgesHandle(({ serialize, edgesEvent, resolve }) => resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) }));
	}

	// Wrap user's handle with edgesHandle
	return edgesHandle(({ serialize, edgesEvent, resolve }) => {
		return userHandle({
			event: edgesEvent,
			resolve: (e, opts) =>
				resolve(e, {
					...opts,
					transformPageChunk: ({ html, done }) => {
						// Apply user's transform first (if any)
						const userTransformed = opts?.transformPageChunk?.({ html, done }) ?? html;
						// Then apply edges serialization
						return typeof userTransformed === 'string' ? serialize(userTransformed) : userTransformed;
					}
				})
		});
	});
}
