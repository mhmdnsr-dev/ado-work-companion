'use client';

import { useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query. Server renders and the first client paint
 * report `false`, so pass the phone-first (mobile) case as the false branch.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
