/**
 * Sprint burndown (Analytics) domain helpers.
 * @see https://learn.microsoft.com/en-us/azure/devops/report/powerbi/sample-boards-sprintburndown
 */

import { fieldNumber, fieldString } from './work-items';
import type { WorkItem } from '../types/work-items';
import type { IdentityRef } from '../types/work-items';
export interface AnalyticsODataResponse<T> {
  '@odata.context'?: string;
  value?: T[];
}

export interface WorkItemSnapshotBurndownRow {
  DateValue?: string;
  TotalRemainingWork?: number | null;
  Count?: number | null;
}

export interface BurndownPoint {
  date: string;
  remainingWork: number;
  idealWork: number;
}

export interface SprintBurndownMetrics {
  remainingWork: number;
  startingWork: number;
  completedPercent: number;
  averageBurndownPerDay: number;
  daysElapsed: number;
  daysRemaining: number;
}

export interface SprintBurndownModel {
  series: BurndownPoint[];
  metrics: SprintBurndownMetrics;
  /** analytics = historical OData; rest = computed from current sprint work items */
  source: 'analytics' | 'rest';
}

export interface SprintSnapshotModel {
  tasksByState: Array<{ state: string; count: number }>;
  openTaskCount: number;
  completedTaskCount: number;
  remainingHours: number;
  completedHours: number;
}

export interface MemberSprintTaskRow {
  id: number;
  title: string;
  type: string;
  state: string;
  remainingHours: number;
  completedHours: number;
  originalEstimate: number | null;
}

export interface MemberSprintStatsModel extends SprintSnapshotModel {
  tasksByType: Array<{ type: string; count: number }>;
  totalTasks: number;
  originalEstimateHours: number;
  tasks: MemberSprintTaskRow[];
}

export interface SprintChartsResult {
  model: SprintBurndownModel;
  items: WorkItem[];
  snapshot?: SprintSnapshotModel;
  nativeChartPath?: string;
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function toDateOnlyIso(value: Date | string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return trimmed.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function daysBetween(startIso: string, endIso: string): number {
  const ms =
    startOfUtcDay(endIso).getTime() - startOfUtcDay(startIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function addUtcDays(isoDate: string, days: number): string {
  const date = startOfUtcDay(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds $apply for remaining-work burndown of Tasks in the current sprint for a team.
 * Prefer team area path when available; fall back to Teams/any(TeamName).
 */
export function buildSprintBurndownApply(params: {
  teamName: string;
  areaPath?: string | null;
  iterationPath?: string | null;
}): string {
  const team = escapeODataString(params.teamName.trim());
  const clauses: string[] = [
    `WorkItemType eq 'Task'`,
    `StateCategory ne 'Completed'`,
    `DateValue ge Iteration/StartDate`,
    `DateValue le Iteration/EndDate`,
  ];

  const area = params.areaPath?.trim();
  if (area) {
    clauses.push(`startswith(Area/AreaPath,'${escapeODataString(area)}')`);
  } else {
    clauses.push(`Teams/any(t:t/TeamName eq '${team}')`);
  }

  const iteration = params.iterationPath?.trim();
  if (iteration) {
    clauses.push(`Iteration/IterationPath eq '${escapeODataString(iteration)}'`);
  } else {
    clauses.push(`Iteration/StartDate le now()`);
    clauses.push(`Iteration/EndDate ge now()`);
  }

  return [
    `filter(${clauses.join(' and ')})`,
    `groupby((DateValue),aggregate(RemainingWork with sum as TotalRemainingWork,$count as Count))`,
  ].join('/');
}

export function parseBurndownRows(
  rows: WorkItemSnapshotBurndownRow[] | undefined,
): Array<{ date: string; remainingWork: number }> {
  const byDate = new Map<string, number>();
  for (const row of rows ?? []) {
    if (!row.DateValue) continue;
    const date = toDateOnlyIso(row.DateValue);
    const remaining =
      typeof row.TotalRemainingWork === 'number' && Number.isFinite(row.TotalRemainingWork)
        ? row.TotalRemainingWork
        : 0;
    byDate.set(date, (byDate.get(date) ?? 0) + remaining);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, remainingWork]) => ({ date, remainingWork }));
}

export function buildIdealBurndown(
  startDate: string,
  endDate: string,
  startingWork: number,
): Array<{ date: string; idealWork: number }> {
  const start = toDateOnlyIso(startDate);
  const end = toDateOnlyIso(endDate);
  const span = Math.max(1, daysBetween(start, end));
  const points: Array<{ date: string; idealWork: number }> = [];
  for (let i = 0; i <= span; i++) {
    const date = addUtcDays(start, i);
    const idealWork = Math.max(0, startingWork * (1 - i / span));
    points.push({ date, idealWork: Number(idealWork.toFixed(2)) });
  }
  return points;
}

export function buildSprintBurndownModel(params: {
  rows: WorkItemSnapshotBurndownRow[] | undefined;
  sprintStart: string;
  sprintEnd: string;
  asOf?: string;
}): SprintBurndownModel {
  const parsed = parseBurndownRows(params.rows);
  const start = toDateOnlyIso(params.sprintStart);
  const end = toDateOnlyIso(params.sprintEnd);
  const asOf = toDateOnlyIso(params.asOf ?? new Date().toISOString());
  const effectiveEnd = asOf < end ? asOf : end;

  const startingWork = parsed[0]?.remainingWork ?? 0;
  const ideal = buildIdealBurndown(start, end, startingWork);
  const idealByDate = new Map(ideal.map((point) => [point.date, point.idealWork]));

  // Fill calendar days from sprint start through today (or sprint end) so the chart is continuous.
  const spanToToday = daysBetween(start, effectiveEnd);
  const remainingByDate = new Map(parsed.map((point) => [point.date, point.remainingWork]));
  let lastKnown = startingWork;
  const series: BurndownPoint[] = [];
  for (let i = 0; i <= spanToToday; i++) {
    const date = addUtcDays(start, i);
    if (remainingByDate.has(date)) {
      lastKnown = remainingByDate.get(date)!;
    }
    series.push({
      date,
      remainingWork: Number(lastKnown.toFixed(2)),
      idealWork: idealByDate.get(date) ?? 0,
    });
  }

  // Extend ideal-only days after today until sprint end for the dashed ideal line context.
  if (effectiveEnd < end) {
    const remainingSpan = daysBetween(effectiveEnd, end);
    for (let i = 1; i <= remainingSpan; i++) {
      const date = addUtcDays(effectiveEnd, i);
      series.push({
        date,
        remainingWork: Number.NaN,
        idealWork: idealByDate.get(date) ?? 0,
      });
    }
  }

  const observed = series.filter((point) => Number.isFinite(point.remainingWork));
  const latest = observed[observed.length - 1];
  const remainingWork = latest?.remainingWork ?? 0;
  const daysElapsed = Math.max(0, daysBetween(start, effectiveEnd));
  const daysRemaining = Math.max(0, daysBetween(effectiveEnd, end));
  const burned = Math.max(0, startingWork - remainingWork);
  const completedPercent =
    startingWork > 0 ? Math.min(100, Math.max(0, (burned / startingWork) * 100)) : 0;
  const averageBurndownPerDay = daysElapsed > 0 ? burned / daysElapsed : 0;

  return {
    series,
    metrics: {
      remainingWork: Number(remainingWork.toFixed(1)),
      startingWork: Number(startingWork.toFixed(1)),
      completedPercent: Number(completedPercent.toFixed(1)),
      averageBurndownPerDay: Number(averageBurndownPerDay.toFixed(1)),
      daysElapsed,
      daysRemaining,
    },
    source: 'analytics',
  };
}

const COMPLETED_TASK_STATES = new Set([
  'Closed',
  'Done',
  'Removed',
  'Complete',
  'Resolved',
]);

function isTask(item: WorkItem): boolean {
  return fieldString(item, 'System.WorkItemType') === 'Task';
}

function isCompletedTask(item: WorkItem): boolean {
  const state = fieldString(item, 'System.State');
  return COMPLETED_TASK_STATES.has(state);
}

/**
 * Builds a burndown model from current sprint work items (no Analytics scope).
 * The actual line linearly interpolates from sprint start to today's remaining total.
 */
export function buildSprintBurndownFromWorkItems(params: {
  items: WorkItem[];
  sprintStart: string;
  sprintEnd: string;
  asOf?: string;
}): SprintBurndownModel {
  const tasks = params.items.filter(isTask);
  let remainingWork = 0;
  let startingWork = 0;
  for (const item of tasks) {
    const remaining = fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork') ?? 0;
    const completed = fieldNumber(item, 'Microsoft.VSTS.Scheduling.CompletedWork') ?? 0;
    if (!isCompletedTask(item)) {
      remainingWork += remaining;
    }
    startingWork += isCompletedTask(item) ? completed : remaining + completed;
  }
  const start = toDateOnlyIso(params.sprintStart);
  const end = toDateOnlyIso(params.sprintEnd);
  const asOf = toDateOnlyIso(params.asOf ?? new Date().toISOString());
  const effectiveEnd = asOf < end ? asOf : end;
  const daysElapsed = Math.max(0, daysBetween(start, effectiveEnd));
  const daysRemaining = Math.max(0, daysBetween(effectiveEnd, end));
  const spanToToday = Math.max(1, daysElapsed);

  const ideal = buildIdealBurndown(start, end, startingWork);
  const idealByDate = new Map(ideal.map((point) => [point.date, point.idealWork]));

  const series: BurndownPoint[] = [];
  for (let i = 0; i <= spanToToday; i++) {
    const date = addUtcDays(start, i);
    const progress = i / spanToToday;
    const interpolated = startingWork - (startingWork - remainingWork) * progress;
    series.push({
      date,
      remainingWork: Number(interpolated.toFixed(2)),
      idealWork: idealByDate.get(date) ?? 0,
    });
  }

  if (effectiveEnd < end) {
    const remainingSpan = daysBetween(effectiveEnd, end);
    for (let i = 1; i <= remainingSpan; i++) {
      const date = addUtcDays(effectiveEnd, i);
      series.push({
        date,
        remainingWork: Number.NaN,
        idealWork: idealByDate.get(date) ?? 0,
      });
    }
  }

  const burned = Math.max(0, startingWork - remainingWork);
  const completedPercent =
    startingWork > 0 ? Math.min(100, Math.max(0, (burned / startingWork) * 100)) : 0;
  const averageBurndownPerDay = daysElapsed > 0 ? burned / daysElapsed : 0;

  return {
    series,
    metrics: {
      remainingWork: Number(remainingWork.toFixed(1)),
      startingWork: Number(startingWork.toFixed(1)),
      completedPercent: Number(completedPercent.toFixed(1)),
      averageBurndownPerDay: Number(averageBurndownPerDay.toFixed(1)),
      daysElapsed,
      daysRemaining,
    },
    source: 'rest',
  };
}

/** Aggregates sprint work item counts and hours for dashboard charts. */
export function buildSprintSnapshotFromWorkItems(
  items: WorkItem[],
  options?: { tasksOnly?: boolean },
): SprintSnapshotModel {
  const tasksOnly = options?.tasksOnly !== false;
  const source = tasksOnly ? items.filter(isTask) : items;
  const stateCounts = new Map<string, number>();
  let openTaskCount = 0;
  let completedTaskCount = 0;
  let remainingHours = 0;
  let completedHours = 0;

  for (const item of source) {
    const state = fieldString(item, 'System.State') || 'Unknown';
    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);

    const remaining = fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork') ?? 0;
    const completed = fieldNumber(item, 'Microsoft.VSTS.Scheduling.CompletedWork') ?? 0;

    if (isCompletedTask(item)) {
      completedTaskCount += 1;
      completedHours += completed;
    } else {
      openTaskCount += 1;
      remainingHours += remaining;
      completedHours += completed;
    }
  }

  const tasksByState = [...stateCounts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count);

  return {
    tasksByState,
    openTaskCount,
    completedTaskCount,
    remainingHours: Number(remainingHours.toFixed(1)),
    completedHours: Number(completedHours.toFixed(1)),
  };
}

function assigneeIdentityId(item: WorkItem): string {
  const assigned = item.fields?.['System.AssignedTo'];
  if (assigned == null) return '';
  if (typeof assigned === 'object' && assigned !== null && 'id' in assigned) {
    return String((assigned as IdentityRef).id ?? '').trim();
  }
  if (typeof assigned === 'string') return assigned.trim();
  return '';
}

/** Keeps work items assigned to the given team member identity id. */
export function filterWorkItemsByAssignee(
  items: WorkItem[],
  memberIdentityId: string,
): WorkItem[] {
  const id = memberIdentityId.trim();
  if (!id) return items;
  return items.filter((item) => assigneeIdentityId(item) === id);
}

/** Detailed sprint statistics for a single member's assigned work items. */
export function buildMemberSprintStats(items: WorkItem[]): MemberSprintStatsModel {
  const snapshot = buildSprintSnapshotFromWorkItems(items, { tasksOnly: false });
  const typeCounts = new Map<string, number>();
  let originalEstimateHours = 0;
  const tasks: MemberSprintTaskRow[] = [];

  for (const item of items) {
    const type = fieldString(item, 'System.WorkItemType') || 'Unknown';
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    originalEstimateHours +=
      fieldNumber(item, 'Microsoft.VSTS.Scheduling.OriginalEstimate') ?? 0;

    if (!item.id) continue;
    tasks.push({
      id: item.id,
      title: fieldString(item, 'System.Title') || `#${item.id}`,
      type,
      state: fieldString(item, 'System.State') || 'Unknown',
      remainingHours: fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork') ?? 0,
      completedHours: fieldNumber(item, 'Microsoft.VSTS.Scheduling.CompletedWork') ?? 0,
      originalEstimate:
        fieldNumber(item, 'Microsoft.VSTS.Scheduling.OriginalEstimate'),
    });
  }

  tasks.sort((a, b) => a.state.localeCompare(b.state) || a.title.localeCompare(b.title));

  const tasksByType = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ...snapshot,
    tasksByType,
    totalTasks: items.length,
    originalEstimateHours: Number(originalEstimateHours.toFixed(1)),
    tasks,
  };
}

/** Proxy path for the native ADO sprint burndown chart image (Work API). */
export function buildIterationBurndownChartPath(params: {
  organization: string;
  project: string;
  team: string;
  iterationId: string;
  apiVersion: string;
  width?: number;
  height?: number;
}): string {
  const parts = [
    encodeURIComponent(params.organization),
    encodeURIComponent(params.project),
    encodeURIComponent(params.team),
    '_apis/work/teamsettings/iterations',
    params.iterationId,
    'chartimages/burndown',
  ];
  const query = new URLSearchParams({
    'api-version': params.apiVersion,
    width: String(params.width ?? 800),
    height: String(params.height ?? 320),
    showDetails: 'true',
  });
  return `/api/ado/${parts.join('/')}?${query.toString()}`;
}
