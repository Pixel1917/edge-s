import type { Handle } from '@sveltejs/kit';
import { edgesHandle } from './EdgesHandleSimplified.js';

interface CompressionOptions {
	compress?: boolean;
	compressionThreshold?: number;
}

/**
 * Automatically wraps a user-defined handle function with edgesHandle.
 * This is used internally by the Vite plugin to provide automatic state management.
 *
 * @internal This function is called automatically by the Vite plugin. You don't need to use it manually.
 *
 * @param userHandle - Optional user-defined handle function from hooks.server.ts
 * @param compressionOptions - Compression configuration from the plugin
 * @param silentChromeDevtools - Whether to silence Chrome DevTools requests
 * @returns A handle function wrapped with edgesHandle for automatic state serialization
 */
export function __autoWrapHandle(userHandle?: Handle, compressionOptions?: CompressionOptions, silentChromeDevtools = true): Handle {
	if (!userHandle) {
		// No user handle - return default edgesHandle with compression options
		return edgesHandle(
			({ serialize, edgesEvent, resolve }) =>
				resolve(edgesEvent, {
					transformPageChunk: ({ html }) => serialize(html, compressionOptions)
				}),
			silentChromeDevtools
		);
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
						// Then apply edges serialization with compression options
						return typeof userTransformed === 'string' ? serialize(userTransformed, compressionOptions) : userTransformed;
					}
				})
		});
	}, silentChromeDevtools);
}
