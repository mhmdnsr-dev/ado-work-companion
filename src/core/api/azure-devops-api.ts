import {
  queryAnalytics as queryAnalyticsRequest,
} from './resources/analytics';
import {
  attachFileToWorkItem as attachFileToWorkItemRequest,
  detachWorkItemAttachment as detachWorkItemAttachmentRequest,
  downloadAttachment as downloadAttachmentRequest,
  uploadAttachment as uploadAttachmentRequest,
} from './resources/attachments';
import {
  addWorkItemComment as addWorkItemCommentRequest,
  listWorkItemComments as listWorkItemCommentsRequest,
} from './resources/comments';
import {
  getClassificationNode as getClassificationNodeRequest,
  getIterationWorkItems as getIterationWorkItemsRequest,
  getTeamSettings as getTeamSettingsRequest,
  listTeamIterations as listTeamIterationsRequest,
  listTeamMembers as listTeamMembersRequest,
  listTeams as listTeamsRequest,
  listWorkItemFields as listWorkItemFieldsRequest,
  listWorkItemRelationTypes as listWorkItemRelationTypesRequest,
  listWorkItemTypes as listWorkItemTypesRequest,
  listWorkItemTypeStates as listWorkItemTypeStatesRequest,
} from './resources/metadata';
import {
  getAuthenticatedUser as getAuthenticatedUserRequest,
  getProject as getProjectRequest,
  listProjects as listProjectsRequest,
  testConnection as testConnectionRequest,
} from './resources/projects';
import {
  getQuery as getQueryRequest,
  listQueries as listQueriesRequest,
  queryById as queryByIdRequest,
} from './resources/queries';
import {
  createWorkItem as createWorkItemRequest,
  deleteWorkItem as deleteWorkItemRequest,
  getWorkItem as getWorkItemRequest,
  getWorkItems as getWorkItemsRequest,
  listWorkItemRevisions as listWorkItemRevisionsRequest,
  queryByWiql as queryByWiqlRequest,
  updateWorkItem as updateWorkItemRequest,
} from './resources/work-items';
import { AdoTransport } from './transport';
import type {
  AdoRequestOptions,
  AdoRequestResult,
  AzureDevOpsApiOptions,
} from './types';
import type { QueryExpand } from '../types/queries';
import type { JsonPatchOperation, WorkItemExpand } from '../types/work-items';

export type {
  AdoRequestOptions,
  AdoRequestResult,
  AzureDevOpsApiOptions,
} from './types';

/**
 * Public ADO client. Each method just forwards to a resource function.
 * Real HTTP logic lives in `AdoTransport`; endpoint logic lives in `resources/*`.
 */
export class AzureDevOpsApi {
  private readonly transport: AdoTransport;

  constructor(options: AzureDevOpsApiOptions) {
    this.transport = new AdoTransport(options);
  }

  updateConfig(partial: {
    organization?: string;
    project?: string | null;
    apiVersion?: string;
    pat?: string;
  }): void {
    this.transport.updateConfig(partial);
  }

  getConfig(): {
    organization: string;
    project?: string;
    apiVersion: string;
    hasPat: boolean;
    usingProxy: boolean;
  } {
    return this.transport.getConfig();
  }

  // --- Projects ---

  listProjects(options?: {
    signal?: AbortSignal;
    stateFilter?: string;
    top?: number;
    skip?: number;
    getDefaultTeamImageUrl?: boolean;
  }) {
    return listProjectsRequest(this.transport, options);
  }

  getAuthenticatedUser(options?: { signal?: AbortSignal }) {
    return getAuthenticatedUserRequest(this.transport, options);
  }

  getProject(
    projectIdOrName: string,
    options?: {
      signal?: AbortSignal;
      includeCapabilities?: boolean;
      includeHistory?: boolean;
    },
  ) {
    return getProjectRequest(this.transport, projectIdOrName, options);
  }

  testConnection(options?: { signal?: AbortSignal }) {
    return testConnectionRequest(this.transport, options);
  }

  // --- Work items ---

  queryByWiql(options: {
    query: string;
    top?: number;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return queryByWiqlRequest(this.transport, options);
  }

  getWorkItems(options: {
    ids: number[];
    fields?: readonly string[];
    expand?: WorkItemExpand;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return getWorkItemsRequest(this.transport, options);
  }

  getWorkItem(options: {
    id: number;
    fields?: readonly string[];
    expand?: WorkItemExpand;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return getWorkItemRequest(this.transport, options);
  }

  createWorkItem(options: {
    type: string;
    operations: JsonPatchOperation[];
    project: string;
    signal?: AbortSignal;
  }) {
    return createWorkItemRequest(this.transport, options);
  }

  updateWorkItem(options: {
    id: number;
    operations: JsonPatchOperation[];
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return updateWorkItemRequest(this.transport, options);
  }

  deleteWorkItem(options: {
    id: number;
    destroy?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return deleteWorkItemRequest(this.transport, options);
  }

  listWorkItemRevisions(options: {
    id: number;
    top?: number;
    skip?: number;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return listWorkItemRevisionsRequest(this.transport, options);
  }

  // --- Queries ---

  listQueries(options?: {
    depth?: number;
    expand?: QueryExpand;
    includeDeleted?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return listQueriesRequest(this.transport, options);
  }

  getQuery(options: {
    idOrPath: string;
    depth?: number;
    expand?: QueryExpand;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return getQueryRequest(this.transport, options);
  }

  queryById(options: {
    id: string;
    top?: number;
    timePrecision?: boolean;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return queryByIdRequest(this.transport, options);
  }

  // --- Attachments ---

  uploadAttachment(options: {
    fileName: string;
    content: ArrayBuffer | Blob;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return uploadAttachmentRequest(this.transport, options);
  }

  downloadAttachment(options: {
    id: string;
    fileName?: string;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return downloadAttachmentRequest(this.transport, options);
  }

  attachFileToWorkItem(options: {
    workItemId: number;
    fileName: string;
    content: ArrayBuffer | Blob;
    comment?: string;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return attachFileToWorkItemRequest(this.transport, options);
  }

  detachWorkItemAttachment(options: {
    workItemId: number;
    relationIndex: number;
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return detachWorkItemAttachmentRequest(this.transport, options);
  }

  // --- Metadata ---

  listTeams(options: { project: string; top?: number; signal?: AbortSignal }) {
    return listTeamsRequest(this.transport, options);
  }

  listTeamMembers(options: {
    project: string;
    team: string;
    top?: number;
    signal?: AbortSignal;
  }) {
    return listTeamMembersRequest(this.transport, options);
  }

  getTeamSettings(options: {
    project: string;
    team: string;
    signal?: AbortSignal;
  }) {
    return getTeamSettingsRequest(this.transport, options);
  }

  listTeamIterations(options: {
    project: string;
    team: string;
    timeframe?: 'current' | 'past' | 'future';
    signal?: AbortSignal;
  }) {
    return listTeamIterationsRequest(this.transport, options);
  }

  getIterationWorkItems(options: {
    project: string;
    team: string;
    iterationId: string;
    signal?: AbortSignal;
  }) {
    return getIterationWorkItemsRequest(this.transport, options);
  }

  getClassificationNode(options: {
    project: string;
    structureGroup: 'areas' | 'iterations';
    depth?: number;
    signal?: AbortSignal;
  }) {
    return getClassificationNodeRequest(this.transport, options);
  }

  listWorkItemTypeStates(options: {
    project: string;
    type: string;
    signal?: AbortSignal;
  }) {
    return listWorkItemTypeStatesRequest(this.transport, options);
  }

  listWorkItemTypes(options: { project: string; signal?: AbortSignal }) {
    return listWorkItemTypesRequest(this.transport, options);
  }

  listWorkItemFields(options?: {
    project?: string | null;
    signal?: AbortSignal;
  }) {
    return listWorkItemFieldsRequest(this.transport, options);
  }

  listWorkItemRelationTypes(options?: { signal?: AbortSignal }) {
    return listWorkItemRelationTypesRequest(this.transport, options);
  }

  // --- Comments ---

  listWorkItemComments(options: {
    id: number;
    project: string;
    top?: number;
    signal?: AbortSignal;
  }) {
    return listWorkItemCommentsRequest(this.transport, options);
  }

  addWorkItemComment(options: {
    id: number;
    project: string;
    text: string;
    signal?: AbortSignal;
  }) {
    return addWorkItemCommentRequest(this.transport, options);
  }

  // --- Analytics ---

  queryAnalytics<T>(options: {
    project: string;
    entity: string;
    apply: string;
    orderby?: string;
    odataVersion?: string;
    signal?: AbortSignal;
  }): Promise<AdoRequestResult<T>> {
    return queryAnalyticsRequest<T>(this.transport, options);
  }

  /** Low-level request — prefer the methods above. */
  request<T>(options: AdoRequestOptions): Promise<AdoRequestResult<T>> {
    return this.transport.request<T>(options);
  }
}
