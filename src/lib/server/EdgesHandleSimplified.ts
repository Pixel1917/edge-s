import type { Handle, RequestEvent, ResolveOptions } from '@sveltejs/kit';
import { edgesHandle as originalEdgesHandle } from './EdgesHandle.js';

type SimplifiedCallback = (params: {
	serialize: (html: string) => string;
	edgesEvent: RequestEvent;
	resolve: (event: RequestEvent, opts?: ResolveOptions) => Response | Promise<Response>;
}) => Response | Promise<Response>;

/**
 * Simplified wrapper around edgesHandle that provides a more convenient API.
 *
 * @example
 * ```ts
 * // Simple usage with default behavior
 * export const handle = edgesHandle(({ serialize, edgesEvent, resolve }) =>
 *   resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) })
 * );
 *
 * // You can still access resolve for custom logic
 * export const handle = edgesHandle(({ serialize, edgesEvent, resolve }) => {
 *   // Custom logic here
 *   return resolve(edgesEvent, { transformPageChunk: ({ html }) => serialize(html) });
 * });
 * ```
 */
export const edgesHandle = (callback: SimplifiedCallback, silentChromeDevtools = true): Handle => {
	return async ({ event, resolve }) => {
		return originalEdgesHandle(
			event,
			({ serialize, edgesEvent }) => {
				return callback({ serialize, edgesEvent, resolve });
			},
			silentChromeDevtools
		);
	};
};
