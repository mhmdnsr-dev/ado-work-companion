import {
  BookOpen,
  Bug,
  ClipboardCheck,
  Crown,
  FileText,
  FlaskConical,
  TriangleAlert,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import type { WorkItemStateCategory } from '@core/domain';

export interface WorkItemTypeVisual {
  icon: LucideIcon;
  /** Text colour class for the glyph (DESIGN.md `--wit-*` tokens). */
  className: string;
}

const STORY: WorkItemTypeVisual = { icon: BookOpen, className: 'text-wit-story' };
const OTHER: WorkItemTypeVisual = { icon: FileText, className: 'text-wit-other' };

const TYPE_VISUALS: Record<string, WorkItemTypeVisual> = {
  epic: { icon: Crown, className: 'text-wit-epic' },
  feature: { icon: Trophy, className: 'text-wit-feature' },
  'user story': STORY,
  'product backlog item': STORY,
  requirement: STORY,
  task: { icon: ClipboardCheck, className: 'text-wit-task' },
  bug: { icon: Bug, className: 'text-wit-bug' },
  issue: { icon: TriangleAlert, className: 'text-wit-other' },
  impediment: { icon: TriangleAlert, className: 'text-wit-other' },
  'test case': { icon: FlaskConical, className: 'text-wit-other' },
};

export function workItemTypeVisual(type: string): WorkItemTypeVisual {
  return TYPE_VISUALS[type.trim().toLowerCase()] ?? OTHER;
}

export const STATE_DOT_CLASS: Record<WorkItemStateCategory, string> = {
  proposed: 'bg-state-proposed',
  inProgress: 'bg-state-in-progress',
  resolved: 'bg-state-resolved',
  completed: 'bg-state-completed',
  removed: 'bg-state-removed',
};

/** Hours as ADO shows them: up to two decimals, trailing zeros dropped (0.25, 1.5, 3). */
export function formatHours(hours: number): string {
  return String(Math.round(hours * 100) / 100);
}

/**
 * Near-white process colours (ADO uses `ffffff` for Removed) vanish on light
 * surfaces, so those fall back to the category token.
 */
export function usableStateColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const n = Number.parseInt(color.slice(1), 16);
  const luminance =
    0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminance > 235 ? undefined : color;
}
