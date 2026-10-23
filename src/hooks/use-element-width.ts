'use client';

import { useCallback, useState } from 'react';

/**
 * Tracks an element's content width. Returns a callback ref plus the width
 * (0 until measured), so charts can render at real pixel size, not a scaled viewBox.
 */
export function useElementWidth<T extends HTMLElement>(): [
  (node: T | null) => void,
  number,
] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: T | null) => {
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
