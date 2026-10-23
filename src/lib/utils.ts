import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Toasts render outside modal layers. Tapping one (e.g. "Undo") must not count
 * as an outside interaction that closes the sheet or dialog underneath.
 */
export function ignoreToastInteractions(event: {
  target: EventTarget | null;
  preventDefault(): void;
}) {
  if (event.target instanceof Element && event.target.closest('[data-sonner-toaster]')) {
    event.preventDefault();
  }
}
