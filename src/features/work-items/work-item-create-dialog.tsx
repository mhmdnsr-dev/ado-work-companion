'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { IdentityRef, JsonPatchOperation, WorkItem } from '@core/types';
import { WORK_ITEM_CREATE_TYPES } from '@core/types';
import { buildWorkItemLinkPatches, identityUniqueName } from '@core/domain';
import { useConnection } from '@/components/providers';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/shared/searchable-select';
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
import { Textarea } from '@/components/ui/textarea';
import { WorkItemLinkFields } from '@/features/work-items/work-item-link-fields';

function preferredCreateTypes(available: string[]): string[] {
  const preferred = WORK_ITEM_CREATE_TYPES.filter((type) => available.includes(type));
  if (preferred.length > 0) return preferred;
  return available;
}

function CreateWorkItemForm({
  project,
  people,
  iterations,
  workItemTypes,
  onCancel,
  onCreated,
}: {
  project: string;
  people: IdentityRef[];
  iterations: SearchableSelectOption[];
  workItemTypes: string[];
  onCancel: () => void;
  onCreated: (item: WorkItem) => void;
}) {
  const { api, settings } = useConnection();
  const createTypes = preferredCreateTypes(workItemTypes);
  const defaultSprint = iterations.at(-1)?.value ?? '';
  const [type, setType] = useState(createTypes[0] ?? 'Task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('2');
  const [iteration, setIteration] = useState(defaultSprint);
  const [sprintTouched, setSprintTouched] = useState(Boolean(defaultSprint));
  const [estimate, setEstimate] = useState('');
  const [tags, setTags] = useState('');
  const [linkType, setLinkType] = useState('');
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const sprintValue = sprintTouched ? iteration : defaultSprint;

  const peopleOptions = people.map((person) => ({
    value: identityUniqueName(person),
    label: person.displayName || person.uniqueName || 'User',
    description: person.uniqueName,
  }));

  async function onSubmit() {
    if (!api) {
      toast.error('Connection is not ready.');
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Add a title to continue.');
      return;
    }

    const operations: JsonPatchOperation[] = [
      { op: 'add', path: '/fields/System.Title', value: trimmedTitle },
    ];
    if (description.trim()) {
      operations.push({
        op: 'add',
        path: '/fields/System.Description',
        value: description.trim(),
      });
    }
    if (assignee.trim()) {
      operations.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: assignee.trim(),
      });
    }
    if (priority) {
      operations.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: Number(priority),
      });
    }
    if (sprintValue.trim()) {
      operations.push({
        op: 'add',
        path: '/fields/System.IterationPath',
        value: sprintValue.trim(),
      });
    }
    if (estimate.trim() !== '' && Number.isFinite(Number(estimate))) {
      const hours = Number(estimate);
      operations.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate',
        value: hours,
      });
      operations.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork',
        value: hours,
      });
    }
    if (tags.trim()) {
      operations.push({
        op: 'add',
        path: '/fields/System.Tags',
        value: tags.trim(),
      });
    }

    if (linkType.trim() && linkedIds.length > 0) {
      operations.push(
        ...buildWorkItemLinkPatches({
          organization: settings.organization,
          linkType,
          targetIds: linkedIds.map((id) => Number(id)),
        }),
      );
    } else if (linkedIds.length > 0 && !linkType.trim()) {
      toast.error('Select a link type before linking work items.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.createWorkItem({
        type,
        project,
        operations,
      });
      onCreated(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create work item');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 py-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <SearchableSelect
            value={type}
            onChange={setType}
            options={(createTypes.length > 0 ? createTypes : workItemTypes).map(
              (name) => ({
                value: name,
                label: name,
              }),
            )}
            placeholder="Select type"
            searchPlaceholder="Search types…"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-title">Title</Label>
          <Input
            id="create-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="touch-target h-11"
            placeholder="What needs to be done?"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-description">Description</Label>
          <Textarea
            id="create-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional details"
            rows={4}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="space-y-2">
            <Label htmlFor="create-priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="create-priority" className="touch-target h-11 w-full">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Sprint</Label>
            <SearchableSelect
              value={sprintValue}
              onChange={(value) => {
                setSprintTouched(true);
                setIteration(value);
              }}
              options={iterations}
              placeholder="Current sprint"
              searchPlaceholder="Search sprints…"
              allowClear
              clearLabel="No sprint"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-estimate">Hours estimate</Label>
            <Input
              id="create-estimate"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              className="touch-target h-11"
              placeholder="e.g. 4"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-tags">Tags</Label>
          <Input
            id="create-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="touch-target h-11"
            placeholder="tag1; tag2"
          />
        </div>

        <WorkItemLinkFields
          project={project}
          linkType={linkType}
          onLinkTypeChange={(value) => {
            setLinkType(value);
            if (!value) setLinkedIds([]);
          }}
          linkedIds={linkedIds}
          onLinkedIdsChange={setLinkedIds}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="touch-target h-11"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="touch-target h-11 gap-2"
          onClick={() => void onSubmit()}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Create
        </Button>
      </DialogFooter>
    </>
  );
}

export function WorkItemCreateDialog({
  open,
  onOpenChange,
  project,
  people,
  iterations,
  workItemTypes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: string;
  people: IdentityRef[];
  iterations: SearchableSelectOption[];
  workItemTypes: string[];
  onCreated: (item: WorkItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92dvh] max-h-[92dvh] overflow-y-auto sm:h-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New work item</DialogTitle>
          <DialogDescription>
            Create a work item in {project} using types from Azure DevOps.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <CreateWorkItemForm
            key="create-form"
            project={project}
            people={people}
            iterations={iterations}
            workItemTypes={workItemTypes}
            onCancel={() => onOpenChange(false)}
            onCreated={(item) => {
              onOpenChange(false);
              onCreated(item);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
