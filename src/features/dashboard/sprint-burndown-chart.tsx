'use client';

import type { BurndownPoint } from '@core/domain';

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

export function SprintBurndownChart({
  series,
  className,
}: {
  series: BurndownPoint[];
  className?: string;
}) {
  const width = 640;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 32, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (series.length === 0) {
    return (
      <div
        className={className}
        role="img"
        aria-label="No burndown data"
      >
        <p className="text-sm text-muted-foreground">No burndown points yet.</p>
      </div>
    );
  }

  const maxY = Math.max(
    1,
    ...series.map((point) =>
      Math.max(
        Number.isFinite(point.remainingWork) ? point.remainingWork : 0,
        point.idealWork,
      ),
    ),
  );

  const xAt = (index: number) =>
    padding.left + (series.length === 1 ? plotW / 2 : (index / (series.length - 1)) * plotW);
  const yAt = (value: number) => padding.top + plotH - (value / maxY) * plotH;

  function polyline(
    values: Array<number | null>,
  ): string {
    return values
      .map((value, index) => {
        if (value == null || !Number.isFinite(value)) return null;
        return `${xAt(index)},${yAt(value)}`;
      })
      .filter((part): part is string => part != null)
      .join(' ');
  }

  const remaining = series.map((point) =>
    Number.isFinite(point.remainingWork) ? point.remainingWork : null,
  );
  const ideal = series.map((point) => point.idealWork);

  const tickIndexes = [
    0,
    Math.floor((series.length - 1) / 2),
    series.length - 1,
  ].filter((value, index, all) => all.indexOf(value) === index);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Sprint burndown chart of remaining work versus ideal"
    >
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + plotH}
        className="stroke-border"
        strokeWidth={1}
      />
      <line
        x1={padding.left}
        y1={padding.top + plotH}
        x2={padding.left + plotW}
        y2={padding.top + plotH}
        className="stroke-border"
        strokeWidth={1}
      />

      {[0, 0.5, 1].map((fraction) => {
        const value = maxY * (1 - fraction);
        const y = padding.top + plotH * fraction;
        return (
          <g key={fraction}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + plotW}
              y2={y}
              className="stroke-border/60"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {Math.round(value)}
            </text>
          </g>
        );
      })}

      <polyline
        fill="none"
        stroke="currentColor"
        className="text-muted-foreground"
        strokeWidth={2}
        strokeDasharray="6 4"
        points={polyline(ideal)}
      />
      <polyline
        fill="none"
        stroke="currentColor"
        className="text-primary"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline(remaining)}
      />

      {tickIndexes.map((index) => (
        <text
          key={series[index]!.date}
          x={xAt(index)}
          y={height - 10}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {formatShortDate(series[index]!.date)}
        </text>
      ))}
    </svg>
  );
}
