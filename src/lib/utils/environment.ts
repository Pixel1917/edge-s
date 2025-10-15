/**
 * Universal browser detection that works in both SvelteKit and non-SvelteKit environments
 * This fixes SSR issues when the package is used in different contexts
 */
export const browser = !import.meta.env.SSR && typeof window !== 'undefined' && typeof document !== 'undefined';
export const dev = import.meta.env.DEV;
