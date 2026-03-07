export const browser = !import.meta.env.SSR && typeof window !== 'undefined' && typeof document !== 'undefined';
export const dev = import.meta.env.DEV;
