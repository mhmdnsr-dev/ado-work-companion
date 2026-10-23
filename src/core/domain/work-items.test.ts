import { describe, expect, it } from 'vitest';

import {
  MAX_LOG_HOURS,
  buildLogWorkPatches,
  buildRemainingWorkPatch,
  buildWorkItemsListWiql,
  findCurrentIterationPath,
  flattenClassificationPaths,
  parseHoursInput,
  planLogWork,
} from './work-items';

describe('flattenClassificationPaths', () => {
  it('preserves nodes and their attributes for current-sprint detection', () => {
    const attributes = {
      startDate: '2026-10-01T00:00:00Z',
      finishDate: '2026-10-14T00:00:00Z',
    };

    expect(
      flattenClassificationPaths({
        id: 1,
        name: 'Mock Project',
        structureType: 'iteration',
        children: [
          {
            id: 2,
            name: 'Sprint 1',
            structureType: 'iteration',
            attributes,
          },
        ],
      }),
    ).toEqual([
      { path: 'Mock Project', name: 'Mock Project' },
      {
        path: 'Mock Project\\Sprint 1',
        name: 'Mock Project\\Sprint 1',
        attributes,
      },
    ]);
  });
});

describe('findCurrentIterationPath', () => {
  const now = new Date('2026-10-23T12:00:00Z');

  it('prefers an explicitly current iteration', () => {
    expect(
      findCurrentIterationPath(
        [
          {
            name: 'Sprint 60',
            path: 'Project\\Sprint 60',
            attributes: {
              startDate: '2026-10-01T00:00:00Z',
              finishDate: '2026-10-14T00:00:00Z',
              timeFrame: 'current',
            },
          },
        ],
        now,
      ),
    ).toBe('Project\\Sprint 60');
  });

  it('falls back to the start and finish dates used by classification nodes', () => {
    expect(
      findCurrentIterationPath(
        [
          {
            name: 'Past',
            path: 'Project\\Past',
            attributes: {
              startDate: '2026-09-01T00:00:00Z',
              finishDate: '2026-09-14T00:00:00Z',
            },
          },
          {
            name: 'Current',
            path: 'Project\\Current',
            attributes: {
              startDate: '2026-10-15T00:00:00Z',
              finishDate: '2026-10-28T00:00:00Z',
            },
          },
          {
            name: 'Future',
            path: 'Project\\Future',
            attributes: {
              startDate: '2026-10-29T00:00:00Z',
              finishDate: '2026-11-11T00:00:00Z',
            },
          },
        ],
        now,
      ),
    ).toBe('Project\\Current');
  });

  it('uses the latest current iteration when several overlap', () => {
    expect(
      findCurrentIterationPath(
        [
          {
            name: 'Older',
            path: 'Project\\Older',
            attributes: { timeFrame: 'current' },
          },
          {
            name: 'Newer',
            path: 'Project\\Newer',
            attributes: { timeFrame: 'current' },
          },
        ],
        now,
      ),
    ).toBe('Project\\Newer');
  });

  it('ignores invalid windows and falls back to the iteration name', () => {
    expect(
      findCurrentIterationPath(
        [
          {
            name: 'Broken',
            attributes: { startDate: 'not-a-date', finishDate: 'also-bad' },
          },
          {
            name: 'Sprint Name Only',
            attributes: {
              startDate: '2026-10-01T00:00:00Z',
              finishDate: '2026-10-31T00:00:00Z',
            },
          },
        ],
        now,
      ),
    ).toBe('Sprint Name Only');
    expect(findCurrentIterationPath([], now)).toBe('');
  });
});

describe('buildWorkItemsListWiql', () => {
  it('adds the WIQL macro for each quick view', () => {
    const wiql = (scope: Parameters<typeof buildWorkItemsListWiql>[0]['scope']) =>
      buildWorkItemsListWiql({ project: 'Web', scope });

    expect(wiql('following')).toContain('[System.Id] IN (@Follows)');
    expect(wiql('mentioned')).toContain('[System.Id] IN (@RecentMentions)');
    expect(wiql('activity')).toContain('[System.Id] IN (@MyRecentActivity)');
    expect(wiql('all')).not.toContain('[System.Id] IN');
    expect(wiql(undefined)).not.toContain('[System.Id] IN');
  });
});

describe('work logging patches', () => {
  const task = (remaining?: number, completed?: number) => ({
    id: 1,
    fields: {
      ...(remaining != null
        ? { 'Microsoft.VSTS.Scheduling.RemainingWork': remaining }
        : {}),
      ...(completed != null
        ? { 'Microsoft.VSTS.Scheduling.CompletedWork': completed }
        : {}),
    },
  });

  it('moves logged hours from remaining to completed', () => {
    const result = buildLogWorkPatches(task(4, 1.5), 2);
    expect(result).toMatchObject({ remaining: 2, completed: 3.5 });
    expect(result.operations).toEqual([
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork', value: 2 },
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.CompletedWork', value: 3.5 },
    ]);
  });

  it('never drops remaining below zero and handles missing fields', () => {
    expect(buildLogWorkPatches(task(0.25), 1)).toMatchObject({
      remaining: 0,
      completed: 1,
    });
    expect(buildLogWorkPatches(task(), 0.5)).toMatchObject({
      remaining: 0,
      completed: 0.5,
    });
    // Floating point: 0.1 + 0.2 must not become 0.30000000000000004.
    expect(buildLogWorkPatches(task(1, 0.1), 0.2).completed).toBe(0.3);
  });

  it('clamps a direct remaining value at zero', () => {
    expect(buildRemainingWorkPatch(-1)[0]?.value).toBe(0);
    expect(buildRemainingWorkPatch(3.333)[0]?.value).toBe(3.33);
  });
});

describe('log work validation and planning', () => {
  const task = (fields: {
    remaining?: number;
    completed?: number;
    original?: number;
  }) => ({
    id: 1,
    fields: {
      ...(fields.remaining != null
        ? { 'Microsoft.VSTS.Scheduling.RemainingWork': fields.remaining }
        : {}),
      ...(fields.completed != null
        ? { 'Microsoft.VSTS.Scheduling.CompletedWork': fields.completed }
        : {}),
      ...(fields.original != null
        ? { 'Microsoft.VSTS.Scheduling.OriginalEstimate': fields.original }
        : {}),
    },
  });

  it('blocks only input that cannot be right', () => {
    expect(parseHoursInput('')).toEqual({ kind: 'empty' });
    expect(parseHoursInput('abc').kind).toBe('invalid');
    expect(parseHoursInput('0').kind).toBe('invalid');
    expect(parseHoursInput('-1').kind).toBe('invalid');
    expect(parseHoursInput(String(MAX_LOG_HOURS + 1)).kind).toBe('invalid');
    expect(parseHoursInput(String(MAX_LOG_HOURS))).toEqual({ kind: 'valid', hours: 40 });
    expect(parseHoursInput('2,5')).toEqual({ kind: 'valid', hours: 2.5 });
    expect(parseHoursInput('0.333')).toEqual({ kind: 'valid', hours: 0.33 });
  });

  it('allows logging past remaining and reports the over-run', () => {
    const plan = planLogWork(task({ remaining: 2, completed: 5, original: 8 }), 3.5);
    expect(plan).toMatchObject({
      remaining: 0,
      completed: 8.5,
      clearsRemaining: true,
      overRemaining: 1.5,
      overEstimate: 0.5,
    });
  });

  it('keeps remaining in the same save when work is still left after an over-run', () => {
    const plan = planLogWork(task({ remaining: 2 }), 3, 2);
    expect(plan.remaining).toBe(2);
    expect(plan.operations).toEqual([
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork', value: 2 },
      { op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.CompletedWork', value: 3 },
    ]);
  });

  it('ignores the remaining override when the log does not clear remaining', () => {
    const plan = planLogWork(task({ remaining: 4 }), 1, 9);
    expect(plan).toMatchObject({
      remaining: 3,
      clearsRemaining: false,
      overRemaining: 0,
    });
  });

  it('reports no estimate over-run without an original estimate', () => {
    expect(planLogWork(task({ remaining: 1, completed: 50 }), 1).overEstimate).toBe(0);
  });
});
