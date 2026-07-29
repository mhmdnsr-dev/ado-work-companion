import type { StorageAdapter } from '@core/ports';

/**
 * Browser localStorage adapter.
 * PAT persistence is gated by the "Remember PAT" flag at the settings layer.
 */
export function createLocalStorageAdapter(): StorageAdapter {
  return {
    async getItem(key) {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    },
    async setItem(key, value) {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
    },
    async removeItem(key) {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    },
    async clear() {
      if (typeof window === 'undefined') return;
      window.localStorage.clear();
    },
  };
}
