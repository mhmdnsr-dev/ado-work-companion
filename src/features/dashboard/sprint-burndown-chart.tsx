'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';

import type { BurndownPoint } from '@core/domain';
import { useElementWidth } from '@/hooks';
import { formatHours } from '@/features/work-items/work-item-visuals';
import { cn } from '@/lib/utils';

const PADDING = { top: 12, right: 40, bottom: 24, left: 36 };

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
      new Date(`${iso.slice(0, 10)}T00:00:00Z`),
    );
  } catch {
    return iso;
  }
}

/** A clean axis maximum: 1, 2, 5 × 10ⁿ steps so ticks read as round numbers. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * power >= value) ?? 10;
  return step * power;
}

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/**
 * Remaining work against the ideal line. Emphasis form: remaining carries the
 * accent and a 10% wash; ideal is context in gray. A crosshair (pointer or
 * ←/→) reads every series at a day, and the data table keeps each value
 * reachable without hovering.
 */
export function SprintBurndownChart({
  series,
  height = 200,
  refreshing = false,
  className,
}: {
  series: BurndownPoint[];
  height?: number;
  /** Holds the previous render, dimmed, while data reloads. */
  refreshing?: boolean;
  className?: string;
}) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (series.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No burndown points yet.
      </p>
    );
  }

  const remaining = series.map((point) => finite(point.remainingWork));
  const lastActual = remaining.reduce<number>(
    (last, value, index) => (value == null ? last : index),
    -1,
  );
  const maxY = niceCeil(
    Math.max(
      1,
      ...series.map((point) =>
        Math.max(finite(point.remainingWork) ?? 0, point.idealWork),
      ),
    ),
  );
  const plotW = Math.max(0, width - PADDING.left - PADDING.right);
  const plotH = height - PADDING.top - PADDING.bottom;
  const xAt = (index: number) =>
    PADDING.left +
    (series.length === 1 ? plotW / 2 : (index / (series.length - 1)) * plotW);
  const yAt = (value: number) => PADDING.top + plotH - (value / maxY) * plotH;

  const path = (values: Array<number | null>) =>
    values
      .map((value, index) => (value == null ? null : `${xAt(index)},${yAt(value)}`))
      .filter((point): point is string => point != null)
      .join(' L ');

  const actualPoints = remaining.slice(0, lastActual + 1);
  const linePath = lastActual >= 0 ? `M ${path(actualPoints)}` : '';
  const areaPath =
    lastActual >= 0
      ? `${linePath} L ${xAt(lastActual)},${yAt(0)} L ${xAt(0)},${yAt(0)} Z`
      : '';
  const idealPath = `M ${path(series.map((point) => point.idealWork))}`;
  const ticks = [0, maxY / 2, maxY];
  const dateTicks = [0, Math.floor((series.length - 1) / 2), series.length - 1].filter(
    (value, index, all) => all.indexOf(value) === index,
  );

  const focusIndex = activeIndex ?? null;
  const active = focusIndex != null ? series[focusIndex] : null;
  const activeRemaining = focusIndex != null ? remaining[focusIndex] : null;
  const endValue = lastActual >= 0 ? remaining[lastActual] : null;

  function indexFromPointer(event: PointerEvent<SVGSVGElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - PADDING.left;
    const ratio = plotW > 0 ? Math.min(1, Math.max(0, x / plotW)) : 0;
    return Math.round(ratio * (series.length - 1));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = activeIndex ?? Math.max(0, lastActual);
    if (event.key === 'ArrowRight')
      setActiveIndex(Math.min(series.length - 1, current + 1));
    else if (event.key === 'ArrowLeft') setActiveIndex(Math.max(0, current - 1));
    else if (event.key === 'Home') setActiveIndex(0);
    else if (event.key === 'End') setActiveIndex(series.length - 1);
    else if (event.key === 'Escape') setActiveIndex(null);
    else return;
    event.preventDefault();
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Two series: a legend with line keys that mirror the marks. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
          Remaining
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-muted-foreground/50" />
          Ideal
        </li>
      </ul>

      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label="Burndown chart. Use the left and right arrow keys to read each day."
        onKeyDown={onKeyDown}
        onFocus={() => setActiveIndex((index) => index ?? Math.max(0, lastActual))}
        onBlur={() => setActiveIndex(null)}
        className={cn(
          'relative rounded-md transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          refreshing && 'opacity-60',
        )}
        style={{ height }}
      >
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            aria-hidden
            className="touch-none select-none"
            onPointerMove={(event) => setActiveIndex(indexFromPointer(event))}
            onPointerDown={(event) => setActiveIndex(indexFromPointer(event))}
            onPointerLeave={() => setActiveIndex(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + plotW}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 6}
                  y={yAt(tick) + 3.5}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {formatHours(tick)}
                </text>
              </g>
            ))}

            <path d={areaPath} className="fill-primary/10" />
            <path
              d={idealPath}
              fill="none"
              className="stroke-muted-foreground/50"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={linePath}
              fill="none"
              className="stroke-primary"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Today: end dot with a surface ring, and its value as the one direct label. */}
            {endValue != null ? (
              <g>
                <circle
                  cx={xAt(lastActual)}
                  cy={yAt(endValue)}
                  r={4}
                  className="fill-primary stroke-card"
                  strokeWidth={2}
                />
                <text
                  x={xAt(lastActual) + 8}
                  y={yAt(endValue) + 3.5}
                  className="fill-foreground text-[11px] font-semibold tabular-nums"
                >
                  {formatHours(endValue)}h
                </text>
              </g>
            ) : null}

            {dateTicks.map((index) => (
              <text
                key={series[index]!.date}
                x={xAt(index)}
                y={height - 6}
                textAnchor={
                  index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'
                }
                className="fill-muted-foreground text-[10px]"
              >
                {formatShortDate(series[index]!.date)}
              </text>
            ))}

            {focusIndex != null ? (
              <g>
                <line
                  x1={xAt(focusIndex)}
                  x2={xAt(focusIndex)}
                  y1={PADDING.top}
                  y2={PADDING.top + plotH}
                  className="stroke-foreground/40"
                  strokeWidth={1}
                />
                <circle
                  cx={xAt(focusIndex)}
                  cy={yAt(series[focusIndex]!.idealWork)}
                  r={4}
                  className="fill-muted-foreground stroke-card"
                  strokeWidth={2}
                />
                {activeRemaining != null ? (
                  <circle
                    cx={xAt(focusIndex)}
                    cy={yAt(activeRemaining)}
                    r={4}
                    className="fill-primary stroke-card"
                    strokeWidth={2}
                  />
                ) : null}
              </g>
            ) : null}
          </svg>
        ) : null}

        {active && focusIndex != null ? (
          <div
            aria-live="polite"
            className="pointer-events-none absolute top-0 z-10 min-w-32 rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md"
            style={
              xAt(focusIndex) > width / 2
                ? { right: width - xAt(focusIndex) + 8 }
                : { left: xAt(focusIndex) + 8 }
            }
          >
            <p className="mb-1 text-muted-foreground">{formatShortDate(active.date)}</p>
            <p className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-3 rounded-full bg-primary" />
              <span className="font-semibold text-foreground tabular-nums">
                {activeRemaining != null ? `${formatHours(activeRemaining)}h` : '—'}
              </span>
              <span className="text-muted-foreground">remaining</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-0.5 w-3 rounded-full bg-muted-foreground/50"
              />
              <span className="font-semibold text-foreground tabular-nums">
                {formatHours(active.idealWork)}h
              </span>
              <span className="text-muted-foreground">ideal</span>
            </p>
          </div>
        ) : null}
      </div>

      <details className="group text-xs">
        <summary className="touch-target flex cursor-pointer items-center text-muted-foreground hover:text-foreground">
          Show data
        </summary>
        <div className="max-h-64 overflow-auto rounded-md border border-border">
          <table className="w-full text-left">
            <caption className="sr-only">Remaining and ideal work per day</caption>
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Day
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Remaining (h)
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Ideal (h)
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((point, index) => (
                <tr key={point.date} className="border-t border-border/70">
                  <td className="px-3 py-1.5">{formatShortDate(point.date)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {remaining[index] != null ? formatHours(remaining[index]!) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {formatHours(point.idealWork)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
