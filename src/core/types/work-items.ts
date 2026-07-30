/**
 * Work Item Tracking types — Azure DevOps WIT REST API.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items?view=azure-devops-rest-7.2
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/wiql/query-by-wiql?view=azure-devops-rest-7.2
 */

import type { ReferenceLinks } from './projects';

export type JsonPatchOperationType =
  'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

export interface JsonPatchOperation {
  op: JsonPatchOperationType;
  path: string;
  value?: unknown;
  from?: string | null;
}

export interface IdentityRef {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  url?: string;
  imageUrl?: string;
  descriptor?: string;
}

export interface WorkItemRelation {
  rel?: string;
  url?: string;
  attributes?: Record<string, unknown>;
}

export interface WorkItem {
  id?: number;
  rev?: number;
  fields?: Record<string, unknown>;
  relations?: WorkItemRelation[];
  _links?: ReferenceLinks;
  url?: string;
}

export interface WorkItemReference {
  id: number;
  url?: string;
}

export interface WorkItemFieldReference {
  referenceName?: string;
  name?: string;
  url?: string;
}

export interface WorkItemQueryResult {
  queryType?: 'flat' | 'tree' | 'oneHop';
  queryResultType?: 'workItem' | 'workItemLink';
  asOf?: string;
  columns?: WorkItemFieldReference[];
  workItems?: WorkItemReference[];
  workItemRelations?: Array<{
    rel?: string;
    source?: WorkItemReference;
    target?: WorkItemReference;
  }>;
}

export type WorkItemExpand = 'None' | 'Relations' | 'Fields' | 'Links' | 'All';

/** Common creatable types for Agile/Scrum/Basic-style processes. */
export const WORK_ITEM_CREATE_TYPES = ['Task', 'Bug', 'User Story'] as const;
export type WorkItemCreateType = (typeof WORK_ITEM_CREATE_TYPES)[number];

export const WORK_ITEM_LIST_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.WorkItemType',
  'System.AssignedTo',
  'System.AreaPath',
  'System.IterationPath',
  'System.Tags',
  'System.Description',
  'System.CreatedDate',
  'System.ChangedDate',
  'Microsoft.VSTS.Common.Priority',
  'Microsoft.VSTS.Scheduling.OriginalEstimate',
  'Microsoft.VSTS.Scheduling.RemainingWork',
  'Microsoft.VSTS.Scheduling.CompletedWork',
] as const;
