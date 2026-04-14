export const browser = !import.meta.env.SSR && typeof window !== 'undefined' && typeof document !== 'undefined';
export const dev = import.meta.env.DEV;
export const build = import.meta.env.PROD;
