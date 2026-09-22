import { z } from 'zod';

import { NAV_ITEMS, type NavItemId } from '../constants/navigation';
import type { StorageAdapter } from '../ports/storage';
import { STORAGE_KEYS } from '../constants/storage-keys';

const navItemIdSchema = z.enum(
  NAV_ITEMS.map((item) => item.id) as [NavItemId, ...NavItemId[]],
);

const favoritesSchema = z.array(z.string());

const DEFAULT_FAVORITES: NavItemId[] = ['dashboard', 'work-items', 'queries', 'settings'];

export async function loadFavorites(storage: StorageAdapter): Promise<NavItemId[]> {
  const raw = await storage.getItem(STORAGE_KEYS.FAVORITES);
  if (!raw) return [...DEFAULT_FAVORITES];

  try {
    const parsed = favoritesSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [...DEFAULT_FAVORITES];
    return parsed.data.filter(
      (id): id is NavItemId => navItemIdSchema.safeParse(id).success,
    );
  } catch {
    return [...DEFAULT_FAVORITES];
  }
}

export async function saveFavorites(
  storage: StorageAdapter,
  favorites: readonly NavItemId[],
): Promise<void> {
  const unique = [...new Set(favorites)];
  await storage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(unique));
}

export async function toggleFavorite(
  storage: StorageAdapter,
  id: NavItemId,
): Promise<NavItemId[]> {
  const current = await loadFavorites(storage);
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  await saveFavorites(storage, next);
  return next;
}
