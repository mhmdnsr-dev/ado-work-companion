import { queryAnalytics } from './resources/analytics';
import {
  attachFileToWorkItem,
  detachWorkItemAttachment,
  downloadAttachment,
  uploadAttachment,
} from './resources/attachments';
import { addWorkItemComment, listWorkItemComments } from './resources/comments';
import {
  getClassificationNode,
  getIterationWorkItems,
  getTeamSettings,
  listTeamIterations,
  listTeamMembers,
  listTeams,
  listWorkItemFields,
  listWorkItemRelationTypes,
  listWorkItemTypes,
  listWorkItemTypeStates,
} from './resources/metadata';
import {
  getAuthenticatedUser,
  getProject,
  listProjects,
  testConnection,
} from './resources/projects';
import { getQuery, listQueries, queryById } from './resources/queries';
import {
  createWorkItem,
  deleteWorkItem,
  getWorkItem,
  getWorkItems,
  listWorkItemRevisions,
  queryByWiql,
  updateWorkItem,
} from './resources/work-items';
import { AdoTransport } from './transport';
import type {
  AdoRequestOptions,
  AdoRequestResult,
  AzureDevOpsApiOptions,
} from './types';

export type {
  AdoRequestOptions,
  AdoRequestResult,
  AzureDevOpsApiOptions,
} from './types';

/**
 * Flat ADO client facade. Endpoint logic lives in `resources/*`; HTTP lives in `AdoTransport`.
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

  listProjects(...args: Parameters<typeof listProjects> extends [unknown, ...infer R] ? R : never) {
    return listProjects(this.transport, ...args);
  }

  getAuthenticatedUser(
    ...args: Parameters<typeof getAuthenticatedUser> extends [unknown, ...infer R] ? R : never
  ) {
    return getAuthenticatedUser(this.transport, ...args);
  }

  getProject(...args: Parameters<typeof getProject> extends [unknown, ...infer R] ? R : never) {
    return getProject(this.transport, ...args);
  }

  testConnection(
    ...args: Parameters<typeof testConnection> extends [unknown, ...infer R] ? R : never
  ) {
    return testConnection(this.transport, ...args);
  }

  queryByWiql(...args: Parameters<typeof queryByWiql> extends [unknown, ...infer R] ? R : never) {
    return queryByWiql(this.transport, ...args);
  }

  listQueries(...args: Parameters<typeof listQueries> extends [unknown, ...infer R] ? R : never) {
    return listQueries(this.transport, ...args);
  }

  getQuery(...args: Parameters<typeof getQuery> extends [unknown, ...infer R] ? R : never) {
    return getQuery(this.transport, ...args);
  }

  queryById(...args: Parameters<typeof queryById> extends [unknown, ...infer R] ? R : never) {
    return queryById(this.transport, ...args);
  }

  getWorkItems(...args: Parameters<typeof getWorkItems> extends [unknown, ...infer R] ? R : never) {
    return getWorkItems(this.transport, ...args);
  }

  getWorkItem(...args: Parameters<typeof getWorkItem> extends [unknown, ...infer R] ? R : never) {
    return getWorkItem(this.transport, ...args);
  }

  createWorkItem(
    ...args: Parameters<typeof createWorkItem> extends [unknown, ...infer R] ? R : never
  ) {
    return createWorkItem(this.transport, ...args);
  }

  updateWorkItem(
    ...args: Parameters<typeof updateWorkItem> extends [unknown, ...infer R] ? R : never
  ) {
    return updateWorkItem(this.transport, ...args);
  }

  uploadAttachment(
    ...args: Parameters<typeof uploadAttachment> extends [unknown, ...infer R] ? R : never
  ) {
    return uploadAttachment(this.transport, ...args);
  }

  downloadAttachment(
    ...args: Parameters<typeof downloadAttachment> extends [unknown, ...infer R] ? R : never
  ) {
    return downloadAttachment(this.transport, ...args);
  }

  attachFileToWorkItem(
    ...args: Parameters<typeof attachFileToWorkItem> extends [unknown, ...infer R] ? R : never
  ) {
    return attachFileToWorkItem(this.transport, ...args);
  }

  detachWorkItemAttachment(
    ...args: Parameters<typeof detachWorkItemAttachment> extends [unknown, ...infer R] ? R : never
  ) {
    return detachWorkItemAttachment(this.transport, ...args);
  }

  deleteWorkItem(
    ...args: Parameters<typeof deleteWorkItem> extends [unknown, ...infer R] ? R : never
  ) {
    return deleteWorkItem(this.transport, ...args);
  }

  listWorkItemRevisions(
    ...args: Parameters<typeof listWorkItemRevisions> extends [unknown, ...infer R] ? R : never
  ) {
    return listWorkItemRevisions(this.transport, ...args);
  }

  listTeams(...args: Parameters<typeof listTeams> extends [unknown, ...infer R] ? R : never) {
    return listTeams(this.transport, ...args);
  }

  listTeamMembers(
    ...args: Parameters<typeof listTeamMembers> extends [unknown, ...infer R] ? R : never
  ) {
    return listTeamMembers(this.transport, ...args);
  }

  getTeamSettings(
    ...args: Parameters<typeof getTeamSettings> extends [unknown, ...infer R] ? R : never
  ) {
    return getTeamSettings(this.transport, ...args);
  }

  listTeamIterations(
    ...args: Parameters<typeof listTeamIterations> extends [unknown, ...infer R] ? R : never
  ) {
    return listTeamIterations(this.transport, ...args);
  }

  getIterationWorkItems(
    ...args: Parameters<typeof getIterationWorkItems> extends [unknown, ...infer R] ? R : never
  ) {
    return getIterationWorkItems(this.transport, ...args);
  }

  getClassificationNode(
    ...args: Parameters<typeof getClassificationNode> extends [unknown, ...infer R] ? R : never
  ) {
    return getClassificationNode(this.transport, ...args);
  }

  listWorkItemTypeStates(
    ...args: Parameters<typeof listWorkItemTypeStates> extends [unknown, ...infer R] ? R : never
  ) {
    return listWorkItemTypeStates(this.transport, ...args);
  }

  listWorkItemTypes(
    ...args: Parameters<typeof listWorkItemTypes> extends [unknown, ...infer R] ? R : never
  ) {
    return listWorkItemTypes(this.transport, ...args);
  }

  listWorkItemFields(
    ...args: Parameters<typeof listWorkItemFields> extends [unknown, ...infer R] ? R : never
  ) {
    return listWorkItemFields(this.transport, ...args);
  }

  listWorkItemRelationTypes(
    ...args: Parameters<typeof listWorkItemRelationTypes> extends [unknown, ...infer R] ? R : never
  ) {
    return listWorkItemRelationTypes(this.transport, ...args);
  }

  listWorkItemComments(
    ...args: Parameters<typeof listWorkItemComments> extends [unknown, ...infer R] ? R : never
  ) {
    return listWorkItemComments(this.transport, ...args);
  }

  addWorkItemComment(
    ...args: Parameters<typeof addWorkItemComment> extends [unknown, ...infer R] ? R : never
  ) {
    return addWorkItemComment(this.transport, ...args);
  }

  queryAnalytics<T>(
    options: {
      project: string;
      entity: string;
      apply: string;
      orderby?: string;
      odataVersion?: string;
      signal?: AbortSignal;
    },
  ): Promise<AdoRequestResult<T>> {
    return queryAnalytics<T>(this.transport, options);
  }

  /** Low-level request — prefer resource methods. Kept for parity with the prior public surface. */
  request<T>(options: AdoRequestOptions): Promise<AdoRequestResult<T>> {
    return this.transport.request<T>(options);
  }
}
