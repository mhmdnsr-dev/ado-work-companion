import { describe, expect, it } from 'vitest';

import type { StorageAdapter } from '../ports/storage';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { parseCollapsedTreeIds, saveCollapsedTreeIds } from './work-item-filters';

function memoryStorage(): StorageAdapter & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}

describe('collapsed tree persistence', () => {
  it('round-trips ids for the same organization and project', async () => {
    const storage = memoryStorage();
    await saveCollapsedTreeIds(storage, 'contoso', 'Web ', new Set([3, 7]));

    const raw = storage.data.get(STORAGE_KEYS.WORK_ITEM_TREE_COLLAPSED) ?? null;
    expect(parseCollapsedTreeIds(raw, 'contoso', 'Web')).toEqual([3, 7]);
  });

  it('ignores ids saved for another project or malformed data', () => {
    const raw = JSON.stringify({ organization: 'contoso', project: 'Web', ids: [3] });
    expect(parseCollapsedTreeIds(raw, 'contoso', 'Mobile')).toEqual([]);
    expect(parseCollapsedTreeIds('{not json', 'contoso', 'Web')).toEqual([]);
    expect(parseCollapsedTreeIds(null, 'contoso', 'Web')).toEqual([]);
  });
});
