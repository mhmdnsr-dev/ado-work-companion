'use client';

import { Check, ChevronsUpDown, Loader2, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { TeamProjectReference } from '@core/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ProjectComboboxProps {
  value: string;
  onChange: (value: string) => void;
  projects: TeamProjectReference[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  disabled?: boolean;
  id?: string;
  allowManualEntry?: boolean;
}

export function ProjectCombobox({
  value,
  onChange,
  projects,
  loading = false,
  error = null,
  onRefresh,
  disabled = false,
  id = 'project-combobox',
  allowManualEntry = true,
}: ProjectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(q) ||
        project.description?.toLowerCase().includes(q),
    );
  }, [projects, query]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-listbox`}
              disabled={disabled}
              className="touch-target h-11 flex-1 justify-between font-normal"
            >
              <span className={cn('truncate', !value && 'text-muted-foreground')}>
                {value || 'Select project (optional)'}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-2"
            align="start"
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="touch-target mb-2 h-11"
              autoFocus
            />
            <div
              id={`${id}-listbox`}
              role="listbox"
              aria-label="Projects"
              className="max-h-60 scrollbar-thin overflow-y-auto"
            >
              {loading ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading projects…
                </div>
              ) : null}

              {!loading && filtered.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {error
                    ? 'Could not load projects. Enter a name manually below.'
                    : 'No projects match your search.'}
                </p>
              ) : null}

              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={cn(
                  'touch-target flex w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent',
                  !value && 'bg-accent',
                )}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setQuery('');
                }}
              >
                <Check className={cn('size-4', value ? 'opacity-0' : 'opacity-100')} />
                <span className="text-muted-foreground">
                  No project (organization only)
                </span>
              </button>

              {filtered.map((project) => {
                const selected = value === project.name;
                return (
                  <button
                    key={project.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      'touch-target flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent',
                      selected && 'bg-accent',
                    )}
                    onClick={() => {
                      onChange(project.name);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{project.name}</span>
                      {project.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {project.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-target size-11 shrink-0"
            onClick={onRefresh}
            disabled={disabled || loading}
            aria-label="Refresh projects"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        ) : null}
      </div>

      {allowManualEntry ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Or type a project name manually"
          aria-label="Project name manual entry"
          disabled={disabled}
          className="touch-target h-11"
        />
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
