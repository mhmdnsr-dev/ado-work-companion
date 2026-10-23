import { describe, expect, it } from 'vitest';

import { findCurrentIterationPath, flattenClassificationPaths } from './work-items';

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
