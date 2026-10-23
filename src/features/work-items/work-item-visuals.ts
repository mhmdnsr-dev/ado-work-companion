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

/** Hours as ADO shows them: whole numbers stay whole, fractions keep one decimal. */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
