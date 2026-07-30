'use client';

import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useMemo, useState, type WheelEvent } from 'react';

import type { SearchableSelectOption } from '@/components/shared/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function stopWheelPropagation(event: WheelEvent) {
  event.stopPropagation();
}

export function SearchableMultiSelect({
  id,
  values,
  onChange,
  options,
  selectedOptions = [],
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  disabled = false,
  loading = false,
  query,
  onQueryChange,
  filterLocally = true,
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: SearchableSelectOption[];
  /** Keeps labels for selected values that may fall out of the current options list. */
  selectedOptions?: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  filterLocally?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState('');
  const search = query ?? internalQuery;

  function setSearch(next: string) {
    if (onQueryChange) onQueryChange(next);
    else setInternalQuery(next);
  }

  const optionByValue = useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    for (const option of selectedOptions) map.set(option.value, option);
    for (const option of options) map.set(option.value, option);
    return map;
  }, [options, selectedOptions]);

  const selected = useMemo(
    () =>
      values.map(
        (value) =>
          optionByValue.get(value) ?? {
            value,
            label: `#${value}`,
          },
      ),
    [optionByValue, values],
  );

  const filtered = useMemo(() => {
    if (!filterLocally) return options;
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.description?.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q),
    );
  }, [filterLocally, options, search]);

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((entry) => entry !== value));
      return;
    }
    onChange([...values, value]);
  }

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && !onQueryChange) setInternalQuery('');
        }}
        modal
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="touch-target h-11 w-full justify-between font-normal"
          >
            <span
              className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}
            >
              {selected.length === 0
                ? placeholder
                : `${selected.length} selected`}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-2"
          align="start"
          onWheel={stopWheelPropagation}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="touch-target mb-2 h-11"
            autoFocus
          />
          <ul
            className="max-h-56 overflow-y-auto overscroll-contain"
            role="listbox"
            onWheel={stopWheelPropagation}
          >
            {loading ? (
              <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</li>
            ) : (
              filtered.map((option) => {
                const active = values.includes(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      title={option.label}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => toggle(option.value)}
                    >
                      <Check
                        className={cn(
                          'mt-0.5 size-4 shrink-0',
                          active ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium" title={option.label}>
                          {option.label}
                        </span>
                        {option.description ? (
                          <span
                            className="block truncate text-xs text-muted-foreground"
                            title={option.description}
                          >
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((option) => (
            <li key={option.value}>
              <Badge variant="secondary" className="gap-1 pr-1" title={option.label}>
                <span className="max-w-[14rem] truncate" title={option.label}>
                  {option.label}
                </span>
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label={`Remove ${option.label}`}
                  disabled={disabled}
                  onClick={() => toggle(option.value)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
