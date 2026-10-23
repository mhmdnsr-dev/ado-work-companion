import {
  Asterisk,
  Award,
  BookOpen,
  Bug,
  Car,
  ChartColumn,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  ClipboardX,
  Code,
  Crown,
  Database,
  Diamond,
  FileText,
  Flame,
  FlaskConical,
  FolderCheck,
  Gavel,
  Gift,
  GitPullRequest,
  Headphones,
  Key,
  Landmark,
  Lightbulb,
  List,
  ListChecks,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  Paintbrush,
  Palette,
  Plane,
  Settings,
  SquareCheck,
  Star,
  StickyNote,
  TrafficCone,
  TriangleAlert,
  Trophy,
  Variable,
  type LucideIcon,
} from 'lucide-react';

import type { WorkItemStateCategory, WorkItemTypeInfo } from '@core/domain';

export interface WorkItemTypeVisual {
  icon: LucideIcon;
  /** Text colour class for the glyph (DESIGN.md `--wit-*` tokens). */
  className: string;
  /** Process colour for custom types; pair with `.wit-custom-glyph`. */
  customColor?: string;
}

/** Lucide stand-ins for the Azure DevOps work item type icon set. */
const ADO_ICONS: Record<string, LucideIcon> = {
  icon_airplane: Plane,
  icon_asterisk: Asterisk,
  icon_book: BookOpen,
  icon_broken_lightbulb: Lightbulb,
  icon_car: Car,
  icon_chart: ChartColumn,
  icon_chat_bubble: MessageSquare,
  icon_check_box: SquareCheck,
  icon_clipboard: ClipboardCheck,
  icon_clipboard_issue: ClipboardX,
  icon_code_response: Code,
  icon_code_review: Code,
  icon_crown: Crown,
  icon_database_storage: Database,
  icon_diamond: Diamond,
  icon_flame: Flame,
  icon_gavel: Gavel,
  icon_gear: Settings,
  icon_gift: Gift,
  icon_github_issue: CircleDot,
  icon_government: Landmark,
  icon_headphone: Headphones,
  icon_insect: Bug,
  icon_key: Key,
  icon_list: List,
  icon_megaphone: Megaphone,
  icon_paint_brush: Paintbrush,
  icon_palette: Palette,
  icon_pull_request: GitPullRequest,
  icon_response: MessageSquareText,
  icon_review: MessageSquareText,
  icon_ribbon: Award,
  icon_star: Star,
  icon_sticky_note: StickyNote,
  icon_test_beaker: FlaskConical,
  icon_test_case: FlaskConical,
  icon_test_parameter: Variable,
  icon_test_plan: ClipboardList,
  icon_test_step: ListChecks,
  icon_test_suite: FolderCheck,
  icon_traffic_cone: TrafficCone,
};

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

/**
 * Standard types keep the DESIGN.md tokens. Custom process types (for example
 * "Meetings") use their ADO icon and colour, so teams recognise them.
 */
export function workItemTypeVisual(
  type: string,
  info?: WorkItemTypeInfo,
): WorkItemTypeVisual {
  const known = TYPE_VISUALS[type.trim().toLowerCase()];
  if (known) return known;
  const icon = (info?.iconId && ADO_ICONS[info.iconId]) || OTHER.icon;
  return info?.color
    ? { icon, className: 'wit-custom-glyph', customColor: info.color }
    : { ...OTHER, icon };
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
