import type {
  IdentityRef,
  JsonPatchOperation,
  WorkItem,
  WorkItemRelation,
} from '../types/work-items';
import type { TeamFieldValue, WorkItemClassificationNode } from '../types/metadata';

/** Escape a string literal for WIQL single-quoted values. */
export function escapeWiqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function fieldValue(item: WorkItem, referenceName: string): unknown {
  return item.fields?.[referenceName];
}

export function fieldString(item: WorkItem, referenceName: string): string {
  const value = fieldValue(item, referenceName);
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null && 'displayName' in value) {
    const identity = value as IdentityRef;
    return identity.displayName?.trim() || identity.uniqueName?.trim() || '';
  }
  return '';
}

export function fieldNumber(item: WorkItem, referenceName: string): number | null {
  const value = fieldValue(item, referenceName);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function identityDisplayName(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'displayName' in value) {
    const identity = value as IdentityRef;
    return identity.displayName?.trim() || identity.uniqueName?.trim() || '';
  }
  return '';
}

export function identityUniqueName(identity: IdentityRef | undefined): string {
  if (!identity) return '';
  return identity.uniqueName?.trim() || identity.displayName?.trim() || identity.id || '';
}

/**
 * Builds HTML mention markup recognized by Azure DevOps comments.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/add
 */
export function buildIdentityMentionHtml(identity: IdentityRef): string {
  const id = identity.id?.trim();
  const name = identity.displayName?.trim() || identity.uniqueName?.trim() || 'user';
  if (!id) return `@${name}`;
  return `<a href="#" data-vss-mention="version:2.0,${id}">@${name}</a>`;
}

export interface IterationCandidate {
  name: string;
  path?: string;
  attributes?: {
    startDate?: string | null;
    finishDate?: string | null;
    timeFrame?: string;
  };
}

/**
 * Flatten a classification tree into selectable path options.
 * Attributes are preserved so callers can still identify a current sprint:
 * classification nodes expose start/finish dates but not `timeFrame`.
 */
export function flattenClassificationPaths(
  node: WorkItemClassificationNode | null | undefined,
  parentPath = '',
): Array<{ path: string; name: string; attributes?: Record<string, unknown> }> {
  if (!node?.name) return [];
  const path = parentPath ? `${parentPath}\\${node.name}` : node.name;
  const self = node.attributes
    ? [{ path, name: path, attributes: node.attributes }]
    : [{ path, name: path }];
  const children = (node.children ?? []).flatMap((child) =>
    flattenClassificationPaths(child, path),
  );
  return [...self, ...children];
}

/**
 * Returns the most recent iteration marked current, or one whose dates contain
 * `now`. Iteration lists are chronological, so scan backwards to prefer the
 * latest current sprint when several windows overlap.
 */
export function findCurrentIterationPath(
  iterations: ReadonlyArray<IterationCandidate>,
  now: Date = new Date(),
): string {
  const nowMs = now.getTime();
  for (let index = iterations.length - 1; index >= 0; index -= 1) {
    const iteration = iterations[index];
    if (!iteration) continue;
    const attributes = iteration.attributes;
    if (!attributes) continue;
    if (attributes.timeFrame === 'current') {
      return iteration.path || iteration.name;
    }
    // Trust explicit past/future team-iteration flags over dates.
    if (attributes.timeFrame === 'past' || attributes.timeFrame === 'future') {
      continue;
    }
    const start = attributes.startDate ? Date.parse(attributes.startDate) : NaN;
    const finish = attributes.finishDate ? Date.parse(attributes.finishDate) : NaN;
    if (
      Number.isFinite(start) &&
      Number.isFinite(finish) &&
      start <= nowMs &&
      nowMs <= finish
    ) {
      return iteration.path || iteration.name;
    }
  }
  return '';
}

/**
 * Builds a practical WIQL filter for the Work Items page (not a free-form editor).
 */
/**
 * ADO "Work Items" hub quick views, backed by WIQL macros.
 * `all` applies no view restriction (the Assigned to me view is `all` + `@Me`).
 */
export type WorkItemScope = 'all' | 'following' | 'mentioned' | 'activity';

const SCOPE_CLAUSES: Record<Exclude<WorkItemScope, 'all'>, string> = {
  following: '[System.Id] IN (@Follows)',
  mentioned: '[System.Id] IN (@RecentMentions)',
  activity: '[System.Id] IN (@MyRecentActivity)',
};

export function buildWorkItemsListWiql(params: {
  project: string;
  scope?: WorkItemScope;
  workItemType?: string;
  /** open = exclude Closed/Removed; all = no state filter; closed = Closed only */
  stateScope?: 'open' | 'all' | 'closed';
  titleContains?: string;
  /** uniqueName / display name, or `@Me` */
  assignedTo?: string;
  iterationPath?: string;
  areaPaths?: TeamFieldValue[];
}): string {
  const project = escapeWiqlString(params.project.trim());
  const clauses: string[] = [`[System.TeamProject] = '${project}'`];

  if (params.scope && params.scope !== 'all') clauses.push(SCOPE_CLAUSES[params.scope]);

  if (params.workItemType && params.workItemType !== 'all') {
    clauses.push(`[System.WorkItemType] = '${escapeWiqlString(params.workItemType)}'`);
  }

  const stateScope = params.stateScope ?? 'open';
  if (stateScope === 'open') {
    clauses.push(`[System.State] <> 'Closed'`);
    clauses.push(`[System.State] <> 'Removed'`);
    clauses.push(`[System.State] <> 'Done'`);
  } else if (stateScope === 'closed') {
    clauses.push(
      `([System.State] = 'Closed' OR [System.State] = 'Done' OR [System.State] = 'Removed')`,
    );
  }

  const title = params.titleContains?.trim();
  if (title) {
    clauses.push(`[System.Title] CONTAINS '${escapeWiqlString(title)}'`);
  }

  const assignedTo = params.assignedTo?.trim();
  if (assignedTo === '@Me') {
    clauses.push(`[System.AssignedTo] = @Me`);
  } else if (assignedTo === '__unassigned__') {
    clauses.push(`[System.AssignedTo] = ''`);
  } else if (assignedTo) {
    clauses.push(`[System.AssignedTo] = '${escapeWiqlString(assignedTo)}'`);
  }

  const iteration = params.iterationPath?.trim();
  if (iteration) {
    clauses.push(`[System.IterationPath] UNDER '${escapeWiqlString(iteration)}'`);
  }

  const areas = params.areaPaths?.filter((area) => area.value?.trim()) ?? [];
  if (areas.length === 1) {
    const area = areas[0]!;
    clauses.push(
      area.includeChildren === false
        ? `[System.AreaPath] = '${escapeWiqlString(area.value)}'`
        : `[System.AreaPath] UNDER '${escapeWiqlString(area.value)}'`,
    );
  } else if (areas.length > 1) {
    const parts = areas.map((area) =>
      area.includeChildren === false
        ? `[System.AreaPath] = '${escapeWiqlString(area.value)}'`
        : `[System.AreaPath] UNDER '${escapeWiqlString(area.value)}'`,
    );
    clauses.push(`(${parts.join(' OR ')})`);
  }

  return [
    'SELECT [System.Id]',
    'FROM WorkItems',
    `WHERE ${clauses.join(' AND ')}`,
    'ORDER BY [System.ChangedDate] DESC',
  ].join(' ');
}

/** Recent work items for the link picker, with optional live id/title search. */
export function buildWorkItemLinkCandidatesWiql(params: {
  project: string;
  search?: string;
}): string {
  const project = escapeWiqlString(params.project.trim());
  const clauses: string[] = [`[System.TeamProject] = '${project}'`];
  const search = params.search?.trim() ?? '';

  if (search) {
    if (/^\d+$/.test(search)) {
      clauses.push(`[System.Id] = ${Number(search)}`);
    } else {
      clauses.push(`[System.Title] CONTAINS '${escapeWiqlString(search)}'`);
    }
  }

  return [
    'SELECT [System.Id]',
    'FROM WorkItems',
    `WHERE ${clauses.join(' AND ')}`,
    'ORDER BY [System.ChangedDate] DESC',
  ].join(' ');
}

/** Canonical ADO work item URL used in relation patches. */
export function buildWorkItemRelationUrl(organization: string, id: number): string {
  const org = organization.trim();
  return `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workItems/${id}`;
}

/** Work-item-to-work-item link types from Azure (excludes attachments/hyperlinks). */
export function workItemLinkTypes(
  types: Array<{
    referenceName: string;
    name: string;
    attributes?: { usage?: string; enabled?: boolean };
  }>,
): Array<{ referenceName: string; name: string }> {
  return types
    .filter(
      (type) =>
        type.attributes?.usage === 'workItemLink' && type.attributes.enabled !== false,
    )
    .map((type) => ({
      referenceName: type.referenceName,
      name: type.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** JSON Patch ops that add one or more work item links. */
export function buildWorkItemLinkPatches(params: {
  organization: string;
  linkType: string;
  targetIds: number[];
}): JsonPatchOperation[] {
  const linkType = params.linkType.trim();
  if (!linkType) return [];

  const ids = [
    ...new Set(params.targetIds.filter((id) => Number.isInteger(id) && id > 0)),
  ];
  return ids.map((id) => ({
    op: 'add' as const,
    path: '/relations/-',
    value: {
      rel: linkType,
      url: buildWorkItemRelationUrl(params.organization, id),
    },
  }));
}

const NON_WORK_ITEM_LINK_RELS = new Set(['AttachedFile', 'Hyperlink', 'ArtifactLink']);

/** Parse a work item id from an ADO relation URL. */
export function parseWorkItemIdFromRelationUrl(url?: string): number | null {
  if (!url) return null;
  const match = url.match(/\/workItems\/(\d+)(?:\?|$)/i);
  if (!match?.[1]) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Parse an attachment GUID from an ADO attachment URL. */
export function parseAttachmentIdFromUrl(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/attachments\/([0-9a-fA-F-]{36})(?:\?|$)/i);
  return match?.[1] ?? null;
}

export interface WorkItemAttachment {
  relationIndex: number;
  attachmentId: string | null;
  url: string;
  name: string;
  comment?: string;
  size?: number;
  createdDate?: string;
}

/** Lists AttachedFile relations from a work item. */
export function listWorkItemAttachments(
  relations: WorkItemRelation[] | undefined,
): WorkItemAttachment[] {
  if (!relations?.length) return [];

  const out: WorkItemAttachment[] = [];
  relations.forEach((relation, index) => {
    if (relation.rel !== 'AttachedFile' || !relation.url) return;
    const attributes = relation.attributes ?? {};
    const name =
      (typeof attributes.name === 'string' && attributes.name.trim()) || 'Attachment';
    const comment =
      typeof attributes.comment === 'string' ? attributes.comment : undefined;
    const size =
      typeof attributes.resourceSize === 'number' ? attributes.resourceSize : undefined;
    const createdDate =
      typeof attributes.resourceCreatedDate === 'string'
        ? attributes.resourceCreatedDate
        : typeof attributes.authorizedDate === 'string'
          ? attributes.authorizedDate
          : undefined;

    out.push({
      relationIndex: index,
      attachmentId: parseAttachmentIdFromUrl(relation.url),
      url: relation.url,
      name,
      comment,
      size,
      createdDate,
    });
  });

  return out;
}

export function isWorkItemLinkRelation(rel?: string): boolean {
  if (!rel) return false;
  return !NON_WORK_ITEM_LINK_RELS.has(rel);
}

export interface ExistingWorkItemLinkGroup {
  linkType: string;
  targetIds: number[];
  /** Indexes into the original relations array (same order as targetIds). */
  relationIndexes: number[];
}

/**
 * Picks the most common work-item link type on the item and returns its targets.
 * Used to prefill the single link-type + multi work-item editor.
 */
export function extractExistingWorkItemLinkGroup(
  relations: WorkItemRelation[] | undefined,
): ExistingWorkItemLinkGroup {
  const entries: Array<{ rel: string; id: number; index: number }> = [];
  (relations ?? []).forEach((relation, index) => {
    if (!isWorkItemLinkRelation(relation.rel)) return;
    const id = parseWorkItemIdFromRelationUrl(relation.url);
    if (id == null || !relation.rel) return;
    entries.push({ rel: relation.rel, id, index });
  });

  if (entries.length === 0) {
    return { linkType: '', targetIds: [], relationIndexes: [] };
  }

  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.rel, (counts.get(entry.rel) ?? 0) + 1);
  }

  let linkType = entries[0]!.rel;
  let best = 0;
  for (const [rel, count] of counts) {
    if (count > best) {
      best = count;
      linkType = rel;
    }
  }

  const matching = entries.filter((entry) => entry.rel === linkType);
  return {
    linkType,
    targetIds: matching.map((entry) => entry.id),
    relationIndexes: matching.map((entry) => entry.index),
  };
}

/** Remove relation patches; highest index first so earlier indexes stay valid. */
export function buildWorkItemLinkRemovePatches(
  relationIndexes: number[],
): JsonPatchOperation[] {
  return [...new Set(relationIndexes)]
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => b - a)
    .map((index) => ({
      op: 'remove' as const,
      path: `/relations/${index}`,
    }));
}

/**
 * Diff current link editor state against the links that were loaded for editing.
 */
export function buildWorkItemLinkUpdatePatches(params: {
  organization: string;
  linkType: string;
  linkedIds: string[];
  existing: ExistingWorkItemLinkGroup;
}): JsonPatchOperation[] {
  const linkType = params.linkType.trim();
  const linkedIds = [...new Set(params.linkedIds.map((id) => id.trim()).filter(Boolean))];
  const existing = params.existing;
  const operations: JsonPatchOperation[] = [];

  if (!linkType || linkedIds.length === 0) {
    if (existing.relationIndexes.length > 0) {
      operations.push(...buildWorkItemLinkRemovePatches(existing.relationIndexes));
    }
    return operations;
  }

  if (linkType === existing.linkType) {
    const current = new Set(linkedIds);
    const removeIndexes = existing.targetIds
      .map((id, index) => ({
        id: String(id),
        relationIndex: existing.relationIndexes[index]!,
      }))
      .filter((entry) => !current.has(entry.id))
      .map((entry) => entry.relationIndex);
    operations.push(...buildWorkItemLinkRemovePatches(removeIndexes));

    const existingIds = new Set(existing.targetIds.map(String));
    const toAdd = linkedIds
      .filter((id) => !existingIds.has(id))
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    operations.push(
      ...buildWorkItemLinkPatches({
        organization: params.organization,
        linkType,
        targetIds: toAdd,
      }),
    );
    return operations;
  }

  operations.push(...buildWorkItemLinkRemovePatches(existing.relationIndexes));
  operations.push(
    ...buildWorkItemLinkPatches({
      organization: params.organization,
      linkType,
      targetIds: linkedIds.map((id) => Number(id)),
    }),
  );
  return operations;
}

const REMAINING_WORK = 'Microsoft.VSTS.Scheduling.RemainingWork';
const COMPLETED_WORK = 'Microsoft.VSTS.Scheduling.CompletedWork';
const ORIGINAL_ESTIMATE = 'Microsoft.VSTS.Scheduling.OriginalEstimate';

/** Hours rounded to two decimals, as ADO stores them (0.25, 1.5). */
function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/**
 * "I spent N hours on this": moves hours from Remaining to Completed in one
 * patch. Remaining never goes below zero.
 */
export function buildLogWorkPatches(
  item: WorkItem,
  hours: number,
): { operations: JsonPatchOperation[]; remaining: number; completed: number } {
  const remaining = roundHours(
    Math.max(0, (fieldNumber(item, REMAINING_WORK) ?? 0) - hours),
  );
  const completed = roundHours((fieldNumber(item, COMPLETED_WORK) ?? 0) + hours);
  return {
    remaining,
    completed,
    operations: [
      { op: 'add', path: `/fields/${REMAINING_WORK}`, value: remaining },
      { op: 'add', path: `/fields/${COMPLETED_WORK}`, value: completed },
    ],
  };
}

/** More than this in one log is almost always a typo ("25" for "2.5"). */
export const MAX_LOG_HOURS = 40;

export type HoursInput =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; hours: number };

/** Parses typed hours ("2.5", "2,5"), rounded to two decimals as ADO stores them. */
export function parseHoursInput(text: string): HoursInput {
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'empty' };
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value))
    return { kind: 'invalid', message: 'Enter a number of hours.' };
  if (value <= 0) return { kind: 'invalid', message: 'Enter more than 0 hours.' };
  if (value > MAX_LOG_HOURS) {
    return {
      kind: 'invalid',
      message: `That’s more than ${MAX_LOG_HOURS}h in one log. Check the amount.`,
    };
  }
  return { kind: 'valid', hours: roundHours(value) };
}

export interface LogWorkPlan {
  operations: JsonPatchOperation[];
  remainingBefore: number;
  remaining: number;
  completed: number;
  /** True when the log uses up all remaining hours (Remaining would be 0). */
  clearsRemaining: boolean;
  /** Hours logged beyond what was remaining. Allowed: estimates are guesses. */
  overRemaining: number;
  /** Hours Completed goes past the Original Estimate, when one is set. */
  overEstimate: number;
  originalEstimate: number | null;
}

/**
 * Plans one "log work" save. Over-runs are allowed and reported, never
 * blocked. When the log clears Remaining, `remainingAfter` lets the user say
 * how much is still left, in the same patch.
 */
export function planLogWork(
  item: WorkItem,
  hours: number,
  remainingAfter?: number,
): LogWorkPlan {
  const remainingBefore = fieldNumber(item, REMAINING_WORK) ?? 0;
  const originalEstimate = fieldNumber(item, ORIGINAL_ESTIMATE);
  const clearsRemaining = hours >= remainingBefore;
  const remaining = roundHours(
    clearsRemaining && remainingAfter != null
      ? Math.max(0, remainingAfter)
      : Math.max(0, remainingBefore - hours),
  );
  const completed = roundHours((fieldNumber(item, COMPLETED_WORK) ?? 0) + hours);
  return {
    remainingBefore,
    remaining,
    completed,
    clearsRemaining,
    overRemaining: roundHours(Math.max(0, hours - remainingBefore)),
    overEstimate:
      originalEstimate != null && originalEstimate > 0
        ? roundHours(Math.max(0, completed - originalEstimate))
        : 0,
    originalEstimate,
    operations: [
      { op: 'add', path: `/fields/${REMAINING_WORK}`, value: remaining },
      { op: 'add', path: `/fields/${COMPLETED_WORK}`, value: completed },
    ],
  };
}

/** Sets Remaining Work directly (negative values clamp to zero). */
export function buildRemainingWorkPatch(hours: number): JsonPatchOperation[] {
  return [
    {
      op: 'add',
      path: `/fields/${REMAINING_WORK}`,
      value: roundHours(Math.max(0, hours)),
    },
  ];
}
