'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { adoQueryKeys } from '@core/constants';
import {
  buildWorkItemLinkCandidatesWiql,
  fieldString,
  workItemLinkTypes,
} from '@core/domain';
import type { WorkItem } from '@core/types';
import { useConnection } from '@/components/providers';
import { SearchableMultiSelect } from '@/components/shared/searchable-multi-select';
import type { SearchableSelectOption } from '@/components/shared/searchable-select';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { Label } from '@/components/ui/label';

const LINK_CANDIDATE_TOP = 50;

function toWorkItemOption(item: WorkItem): SearchableSelectOption | null {
  if (item.id == null) return null;
  const title = fieldString(item, 'System.Title') || 'Untitled';
  const type = fieldString(item, 'System.WorkItemType');
  const state = fieldString(item, 'System.State');
  return {
    value: String(item.id),
    label: `#${item.id} ${title}`,
    description: [type, state].filter(Boolean).join(' · '),
  };
}

export function WorkItemLinkFields({
  project,
  excludeIds = [],
  linkType,
  onLinkTypeChange,
  linkedIds,
  onLinkedIdsChange,
  seedSelectedOptions = [],
}: {
  project: string;
  excludeIds?: number[];
  linkType: string;
  onLinkTypeChange: (value: string) => void;
  linkedIds: string[];
  onLinkedIdsChange: (values: string[]) => void;
  seedSelectedOptions?: SearchableSelectOption[];
}) {
  const { api, settings } = useConnection();
  const organization = settings.organization;
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCache, setSelectedCache] = useState<SearchableSelectOption[]>(
    () => seedSelectedOptions,
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const relationTypesQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.relationTypes(organization),
    enabled: Boolean(api && organization),
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemRelationTypes({ signal });
    },
  });

  const candidatesQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.linkCandidates(
      organization,
      project,
      debouncedSearch,
    ),
    enabled: Boolean(api && organization && project),
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      const wiql = await api.queryByWiql({
        project,
        query: buildWorkItemLinkCandidatesWiql({
          project,
          search: debouncedSearch,
        }),
        top: LINK_CANDIDATE_TOP,
        signal,
      });
      const ids = (wiql.data.workItems ?? []).map((item) => item.id).filter(Boolean);
      if (ids.length === 0) return [] as WorkItem[];
      const items = await api.getWorkItems({
        ids,
        project,
        fields: [
          'System.Id',
          'System.Title',
          'System.WorkItemType',
          'System.State',
        ],
        signal,
      });
      return items.data;
    },
  });

  const linkTypeOptions = useMemo(
    () =>
      workItemLinkTypes(relationTypesQuery.data?.data ?? []).map((type) => ({
        value: type.referenceName,
        label: type.name,
        description: type.referenceName,
      })),
    [relationTypesQuery.data?.data],
  );

  const workItemOptions = useMemo(
    () =>
      (candidatesQuery.data ?? [])
        .filter((item) => item.id != null && !exclude.has(item.id))
        .map(toWorkItemOption)
        .filter((option): option is SearchableSelectOption => option != null),
    [candidatesQuery.data, exclude],
  );

  const selectedDetailsQuery = useQuery({
    queryKey: [
      ...adoQueryKeys.workItems.meta.linkCandidates(organization, project, '__selected__'),
      linkedIds.join(','),
    ],
    enabled: Boolean(api && organization && project && linkedIds.length > 0),
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      const ids = linkedIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0 && !exclude.has(id));
      if (ids.length === 0) return [] as WorkItem[];
      const items = await api.getWorkItems({
        ids,
        project,
        fields: [
          'System.Id',
          'System.Title',
          'System.WorkItemType',
          'System.State',
        ],
        signal,
      });
      return items.data;
    },
  });

  const resolvedSelectedOptions = useMemo(() => {
    const map = new Map<string, SearchableSelectOption>();
    for (const option of seedSelectedOptions) map.set(option.value, option);
    for (const option of selectedCache) map.set(option.value, option);
    for (const option of workItemOptions) map.set(option.value, option);
    for (const item of selectedDetailsQuery.data ?? []) {
      const option = toWorkItemOption(item);
      if (option) map.set(option.value, option);
    }
    return linkedIds.map(
      (id) => map.get(id) ?? ({ value: id, label: `#${id}` }),
    );
  }, [
    linkedIds,
    seedSelectedOptions,
    selectedCache,
    selectedDetailsQuery.data,
    workItemOptions,
  ]);

  function handleLinkedIdsChange(next: string[]) {
    const nextCache = [...selectedCache];
    for (const id of next) {
      if (nextCache.some((option) => option.value === id)) continue;
      const fromResolved = resolvedSelectedOptions.find((option) => option.value === id);
      const fromOptions = workItemOptions.find((option) => option.value === id);
      const option = fromOptions ?? fromResolved;
      if (option) nextCache.push(option);
    }
    setSelectedCache(nextCache.filter((option) => next.includes(option.value)));
    onLinkedIdsChange(next);
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <p className="text-sm font-medium">Link</p>
        <p className="text-xs text-muted-foreground">
          Optional. Recent 50 work items, with live search by id or title.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Link type</Label>
        <SearchableSelect
          value={linkType}
          onChange={onLinkTypeChange}
          options={linkTypeOptions}
          placeholder="Select link type"
          searchPlaceholder="Search link types…"
          allowClear
          clearLabel="No link"
          disabled={relationTypesQuery.isLoading}
          emptyText={
            relationTypesQuery.isError
              ? 'Could not load link types'
              : 'No link types'
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Work items to link</Label>
        <SearchableMultiSelect
          values={linkedIds}
          onChange={handleLinkedIdsChange}
          options={workItemOptions}
          selectedOptions={resolvedSelectedOptions}
          placeholder="Select work items"
          searchPlaceholder="Search by id or title…"
          disabled={!linkType}
          loading={candidatesQuery.isFetching}
          query={searchInput}
          onQueryChange={setSearchInput}
          filterLocally={false}
          emptyText={
            candidatesQuery.isError
              ? 'Could not load work items'
              : debouncedSearch
                ? 'No matches'
                : 'No recent work items'
          }
        />
      </div>
    </div>
  );
}
