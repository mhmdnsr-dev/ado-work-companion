'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { adoQueryKeys } from '@core/constants';
import {
  buildWorkItemLinkUpdatePatches,
  extractExistingWorkItemLinkGroup,
  fieldNumber,
  fieldString,
  flattenClassificationPaths,
  identityDisplayName,
  identityUniqueName,
} from '@core/domain';
import type {
  IdentityRef,
  JsonPatchOperation,
  WorkItem,
  WorkItemRelation,
} from '@core/types';
import { useConnection } from '@/components/providers';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/shared/searchable-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { WorkItemAttachmentsPanel } from '@/features/attachments';
import { WorkItemCommentsPanel } from '@/features/work-items/work-item-comments-panel';
import { WorkItemLinkFields } from '@/features/work-items/work-item-link-fields';

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function relationLabel(rel?: string): string {
  if (!rel) return 'Linked item';
  const short = rel.split('.').pop() ?? rel;
  return short.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function hourInputValue(value: number | null): string {
  return value == null ? '' : String(value);
}

function WorkItemEditor({
  item,
  project,
  organization,
  people,
  iterations,
  revisions,
  revisionsLoading,
  onChanged,
  onClose,
}: {
  item: WorkItem;
  project: string;
  organization: string;
  people: IdentityRef[];
  iterations: SearchableSelectOption[];
  revisions: WorkItem[];
  revisionsLoading: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { api } = useConnection();
  const queryClient = useQueryClient();
  const workItemType = fieldString(item, 'System.WorkItemType');

  const [title, setTitle] = useState(() => fieldString(item, 'System.Title'));
  const [description, setDescription] = useState(() =>
    stripHtml(fieldString(item, 'System.Description')),
  );
  const [state, setState] = useState(() => fieldString(item, 'System.State'));
  const [assignee, setAssignee] = useState(() =>
    identityUniqueName(
      typeof item.fields?.['System.AssignedTo'] === 'object'
        ? (item.fields['System.AssignedTo'] as IdentityRef)
        : { uniqueName: fieldString(item, 'System.AssignedTo') },
    ),
  );
  const [priority, setPriority] = useState(() =>
    String(fieldNumber(item, 'Microsoft.VSTS.Common.Priority') ?? 2),
  );
  const [area, setArea] = useState(() => fieldString(item, 'System.AreaPath'));
  const [iteration, setIteration] = useState(() =>
    fieldString(item, 'System.IterationPath'),
  );
  const [tags, setTags] = useState(() => fieldString(item, 'System.Tags'));
  const [originalEstimate, setOriginalEstimate] = useState(() =>
    hourInputValue(fieldNumber(item, 'Microsoft.VSTS.Scheduling.OriginalEstimate')),
  );
  const [remainingWork, setRemainingWork] = useState(() =>
    hourInputValue(fieldNumber(item, 'Microsoft.VSTS.Scheduling.RemainingWork')),
  );
  const [completedWork, setCompletedWork] = useState(() =>
    hourInputValue(fieldNumber(item, 'Microsoft.VSTS.Scheduling.CompletedWork')),
  );
  const existingLinks = useMemo(
    () => extractExistingWorkItemLinkGroup(item.relations),
    [item.relations],
  );
  const [linkType, setLinkType] = useState(existingLinks.linkType);
  const [linkedIds, setLinkedIds] = useState(() => existingLinks.targetIds.map(String));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statesQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.states(organization, project, workItemType),
    enabled: Boolean(api && workItemType),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemTypeStates({ project, type: workItemType, signal });
    },
  });

  const areasQuery = useQuery({
    queryKey: adoQueryKeys.workItems.meta.classification(organization, project, 'areas'),
    enabled: Boolean(api && project),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.getClassificationNode({
        project,
        structureGroup: 'areas',
        depth: 5,
        signal,
      });
    },
  });

  const stateOptions = useMemo(() => {
    const fromApi = (statesQuery.data?.data ?? []).map((entry) => entry.name);
    if (state && !fromApi.includes(state)) fromApi.unshift(state);
    return fromApi;
  }, [statesQuery.data?.data, state]);

  const areaOptions = useMemo(() => {
    const paths = flattenClassificationPaths(areasQuery.data?.data);
    return paths.map((entry) => ({
      value: entry.path,
      label: entry.name,
    }));
  }, [areasQuery.data?.data]);

  const peopleOptions = people.map((person) => ({
    value: identityUniqueName(person),
    label: person.displayName || person.uniqueName || 'User',
    description: person.uniqueName,
  }));

  const relations = item.relations ?? [];
  const nonAttachmentRelations = relations.filter(
    (relation) => relation.rel !== 'AttachedFile',
  );

  function hourPatch(field: string, value: string, operations: JsonPatchOperation[]) {
    const trimmed = value.trim();
    if (!trimmed) {
      operations.push({ op: 'remove', path: `/fields/${field}` });
      return;
    }
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return;
    operations.push({
      op: 'add',
      path: `/fields/${field}`,
      value: numeric,
    });
  }

  async function onSave() {
    if (!api || !item.id) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title is required.');
      return;
    }

    const operations: JsonPatchOperation[] = [
      { op: 'add', path: '/fields/System.Title', value: trimmedTitle },
      { op: 'add', path: '/fields/System.Description', value: description.trim() },
      { op: 'add', path: '/fields/System.State', value: state.trim() },
      {
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: Number(priority),
      },
      { op: 'add', path: '/fields/System.Tags', value: tags.trim() },
    ];

    if (assignee.trim()) {
      operations.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: assignee.trim(),
      });
    } else {
      operations.push({ op: 'remove', path: '/fields/System.AssignedTo' });
    }

    if (area.trim()) {
      operations.push({ op: 'add', path: '/fields/System.AreaPath', value: area.trim() });
    }
    if (iteration.trim()) {
      operations.push({
        op: 'add',
        path: '/fields/System.IterationPath',
        value: iteration.trim(),
      });
    }

    hourPatch('Microsoft.VSTS.Scheduling.OriginalEstimate', originalEstimate, operations);
    hourPatch('Microsoft.VSTS.Scheduling.RemainingWork', remainingWork, operations);
    hourPatch('Microsoft.VSTS.Scheduling.CompletedWork', completedWork, operations);

    if (linkedIds.length > 0 && !linkType.trim()) {
      toast.error('Select a link type before linking work items.');
      return;
    }
    operations.push(
      ...buildWorkItemLinkUpdatePatches({
        organization,
        linkType,
        linkedIds,
        existing: existingLinks,
      }),
    );

    setSaving(true);
    try {
      await api.updateWorkItem({ id: item.id, project, operations });
      toast.success(`Updated #${item.id}`);
      await queryClient.invalidateQueries({
        queryKey: adoQueryKeys.workItems.detail(organization, item.id),
      });
      await queryClient.invalidateQueries({
        queryKey: adoQueryKeys.workItems.revisions(organization, item.id),
      });
      onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!api || !item.id) return;
    setDeleting(true);
    try {
      await api.deleteWorkItem({ id: item.id, project, destroy: false });
      toast.success(`Moved #${item.id} to the recycle bin`);
      setConfirmDelete(false);
      onClose();
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete work item');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="space-y-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{fieldString(item, 'System.State') || '—'}</Badge>
            <Badge variant="secondary">{workItemType || 'Work item'}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wi-title">Title</Label>
            <Input
              id="wi-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="touch-target h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wi-description">Description</Label>
            <Textarea
              id="wi-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wi-state">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="wi-state" className="touch-target h-11 w-full">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wi-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="wi-priority" className="touch-target h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Critical</SelectItem>
                  <SelectItem value="2">2 — High</SelectItem>
                  <SelectItem value="3">3 — Medium</SelectItem>
                  <SelectItem value="4">4 — Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assigned to</Label>
            <SearchableSelect
              value={assignee}
              onChange={setAssignee}
              options={peopleOptions}
              placeholder="Unassigned"
              searchPlaceholder="Search people…"
              allowClear
              clearLabel="Unassigned"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Area</Label>
              <SearchableSelect
                value={area}
                onChange={setArea}
                options={areaOptions}
                placeholder="Select area"
                searchPlaceholder="Search areas…"
              />
            </div>
            <div className="space-y-2">
              <Label>Sprint</Label>
              <SearchableSelect
                value={iteration}
                onChange={setIteration}
                options={iterations}
                placeholder="Select sprint"
                searchPlaceholder="Search sprints…"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="wi-original">Original estimate (h)</Label>
              <Input
                id="wi-original"
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                value={originalEstimate}
                onChange={(event) => setOriginalEstimate(event.target.value)}
                className="touch-target h-11"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wi-remaining">Remaining (h)</Label>
              <Input
                id="wi-remaining"
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                value={remainingWork}
                onChange={(event) => setRemainingWork(event.target.value)}
                className="touch-target h-11"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wi-completed">Completed (h)</Label>
              <Input
                id="wi-completed"
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                value={completedWork}
                onChange={(event) => setCompletedWork(event.target.value)}
                className="touch-target h-11"
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wi-tags">Tags</Label>
            <Input
              id="wi-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="touch-target h-11"
              placeholder="tag1; tag2"
            />
          </div>

          <WorkItemLinkFields
            project={project}
            excludeIds={item.id ? [item.id] : []}
            linkType={linkType}
            onLinkTypeChange={(value) => {
              setLinkType(value);
              if (!value) setLinkedIds([]);
            }}
            linkedIds={linkedIds}
            onLinkedIdsChange={setLinkedIds}
          />

          {item.id ? (
            <WorkItemCommentsPanel
              workItemId={item.id}
              project={project}
              people={people}
            />
          ) : null}

          {item.id ? (
            <WorkItemAttachmentsPanel
              workItemId={item.id}
              project={project}
              organization={organization}
              relations={item.relations}
              onChanged={async () => {
                const workItemId = item.id;
                if (workItemId == null) return;
                await queryClient.invalidateQueries({
                  queryKey: adoQueryKeys.workItems.detail(organization, workItemId),
                });
              }}
            />
          ) : null}

          {nonAttachmentRelations.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Related work</h3>
              <ul className="space-y-2">
                {nonAttachmentRelations.map(
                  (relation: WorkItemRelation, index: number) => (
                    <li
                      key={`${relation.rel}-${relation.url}-${index}`}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{relationLabel(relation.rel)}</span>
                      {relation.url ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {relation.url.split('/').pop()}
                        </p>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Recent activity</h3>
            {revisionsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : revisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : (
              <ul className="space-y-2">
                {revisions.slice(0, 8).map((revision) => (
                  <li
                    key={revision.rev}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      Revision {revision.rev}
                      {fieldString(revision, 'System.State')
                        ? ` · ${fieldString(revision, 'System.State')}`
                        : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(fieldString(revision, 'System.ChangedDate'))}
                      {identityDisplayName(revision.fields?.['System.ChangedBy'])
                        ? ` · ${identityDisplayName(revision.fields?.['System.ChangedBy'])}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <SheetFooter className="shrink-0 border-t border-border sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="destructive"
          className="touch-target order-last h-11 gap-2 sm:order-none"
          disabled={saving || deleting}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="touch-target h-11"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            className="touch-target h-11 gap-2"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </SheetFooter>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete work item #{item.id}?</DialogTitle>
            <DialogDescription>
              It will move to the Azure DevOps recycle bin so it can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-target h-11"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="touch-target h-11 gap-2"
              onClick={() => void onDelete()}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkItemDetailSheet({
  open,
  onOpenChange,
  workItemId,
  project,
  people,
  iterations,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId: number | null;
  project: string;
  people: IdentityRef[];
  iterations: SearchableSelectOption[];
  onChanged: () => void;
}) {
  const { api, settings } = useConnection();
  const id = workItemId ?? 0;
  const organization = settings.organization;

  const detailQuery = useQuery({
    queryKey: adoQueryKeys.workItems.detail(organization, id),
    enabled: open && Boolean(api && id && organization),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.getWorkItem({ id, project, expand: 'Relations', signal });
    },
  });

  const revisionsQuery = useQuery({
    queryKey: adoQueryKeys.workItems.revisions(organization, id),
    enabled: open && Boolean(api && id && organization),
    queryFn: async ({ signal }) => {
      if (!api) throw new Error('Connection is not ready.');
      return api.listWorkItemRevisions({ id, project, top: 20, signal });
    },
  });

  const item = detailQuery.data?.data;
  const revisions = [...(revisionsQuery.data?.data ?? [])].reverse();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="inset-0 flex h-dvh max-h-dvh w-full flex-col gap-0 overflow-hidden border-0 p-0 md:inset-y-0 md:right-0 md:left-auto md:w-3/4 md:max-w-xl md:border-l">
        <SheetHeader className="shrink-0 border-b border-border pr-12">
          <SheetTitle>
            {item?.id ? `#${item.id}` : 'Work item'}
            {item && fieldString(item, 'System.WorkItemType')
              ? ` · ${fieldString(item, 'System.WorkItemType')}`
              : ''}
          </SheetTitle>
          <SheetDescription>
            Update planning fields, estimates, and comments for this work item.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          {detailQuery.isLoading ? (
            <div className="space-y-3 px-4 py-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : null}

          {detailQuery.isError ? (
            <div className="px-4 py-4">
              <Alert variant="destructive">
                <AlertTitle>Could not load work item</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>
                    {detailQuery.error instanceof Error
                      ? detailQuery.error.message
                      : 'Unexpected error.'}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="touch-target h-11 w-fit"
                    onClick={() => void detailQuery.refetch()}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {item ? (
            <WorkItemEditor
              key={`${item.id}-${item.rev ?? 0}`}
              item={item}
              project={project}
              organization={organization}
              people={people}
              iterations={iterations}
              revisions={revisions}
              revisionsLoading={revisionsQuery.isLoading}
              onChanged={onChanged}
              onClose={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
