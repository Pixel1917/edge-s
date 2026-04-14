import type { Handle } from '@sveltejs/kit';
import { edgesHandle } from './EdgesHandleSimplified.js';

/**
 * Automatically wraps a user-defined handle function with edgesHandle.
 * This is used internally by the Vite plugin to provide automatic state management.
 *
 * @internal This function is called automatically by the Vite plugin. You don't need to use it manually.
 *
 * @param userHandle - Optional user-defined handle function from hooks.server.ts
 * @param silentChromeDevtools - Whether to silence Chrome DevTools requests
 * @returns A handle function wrapped with edgesHandle for automatic state serialization
 */
export function __autoWrapHandle(userHandle?: Handle, silentChromeDevtools = true): Handle {
	if (!userHandle) {
		return edgesHandle(
			({ serialize, edgesEvent, resolve }) =>
				resolve(edgesEvent, {
					transformPageChunk: ({ html }) => serialize(html)
				}),
			silentChromeDevtools
		);
	}

	return edgesHandle(({ serialize, edgesEvent, resolve }) => {
		return userHandle({
			event: edgesEvent,
			resolve: (e, opts) =>
				resolve(e, {
					...opts,
					transformPageChunk: ({ html, done }) => {
						const userTransformed = opts?.transformPageChunk?.({ html, done }) ?? html;
						return typeof userTransformed === 'string' ? serialize(userTransformed) : userTransformed;
					}
				})
		});
	}, silentChromeDevtools);
}
