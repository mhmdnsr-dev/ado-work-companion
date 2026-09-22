import { describe, expect, it } from 'vitest';

import type { StorageAdapter } from '../ports/storage';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { loadFavorites } from './favorites';

function storageWithFavorites(value: string | null): StorageAdapter {
  return {
    getItem: async (key) => (key === STORAGE_KEYS.FAVORITES ? value : null),
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
}

describe('loadFavorites', () => {
  it('uses focused defaults when no favorites are stored', async () => {
    await expect(loadFavorites(storageWithFavorites(null))).resolves.toEqual([
      'dashboard',
      'work-items',
      'queries',
      'settings',
    ]);
  });

  it('drops unknown navigation IDs and preserves valid favorites', async () => {
    const stored = JSON.stringify(['work-items', 'unknown-section', 'help']);
    await expect(loadFavorites(storageWithFavorites(stored))).resolves.toEqual([
      'work-items',
      'help',
    ]);
  });

  it('falls back to defaults for malformed storage', async () => {
    await expect(loadFavorites(storageWithFavorites('{broken'))).resolves.toEqual([
      'dashboard',
      'work-items',
      'queries',
      'settings',
    ]);
  });
});
