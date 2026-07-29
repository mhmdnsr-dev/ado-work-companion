/**
 * Platform-agnostic shared core.
 * Consumable by Next.js today and React Native / Expo later.
 * Must not import next/*, react-dom, or DOM globals — enforced by ESLint.
 */
export * from './constants';
export * from './ports';
export * from './schemas';
export * from './types';
export * from './utils';
