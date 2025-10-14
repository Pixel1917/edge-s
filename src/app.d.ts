// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}

		/**
		 * Extended context data for edges-svelte
		 *
		 * Override this interface to add type-safe custom properties to your context.
		 * These properties will be available in all stores and providers.
		 *
		 * @example
		 * ```ts
		 * // In your app.d.ts:
		 * interface ContextDataExtended {
		 *   userId?: string;
		 *   sessionId?: string;
		 *   userPreferences?: {
		 *     theme: 'light' | 'dark';
		 *     language: string;
		 *   };
		 * }
		 * ```
		 *
		 * Then in your stores:
		 * ```ts
		 * const context = RequestContext.current();
		 * const userId = context.data.userId; // Type-safe!
		 * ```
		 */
		interface ContextDataExtended {
			// Default allows any properties for backwards compatibility
			// Override this interface to add type safety
			[key: string]: unknown;
		}
	}
}

export {};
