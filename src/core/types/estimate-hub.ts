/**
 * Types for ms-devlabs Estimate hub sessions (Extension Data documents).
 * @see https://github.com/microsoft/azure-boards-estimate/blob/main/src/model/session.ts
 */

export enum EstimateHubSessionMode {
  Online = 0,
  Offline = 1,
}

export enum EstimateHubSessionSource {
  Sprint = 0,
  Query = 1,
  Ids = 2,
}

export interface EstimateHubSessionDocument {
  id: string;
  name: string;
  mode?: EstimateHubSessionMode | number;
  version?: number;
  source?: EstimateHubSessionSource | number;
  /** Sprint: "teamId;iterationId"; Query: queryId; Ids: number[] */
  sourceData?: string | number[];
  createdAt?: string | Date;
  createdBy?: string;
  cardSet?: string;
  onlyCreatorCanSwitch?: boolean;
  isLegacy?: boolean;
  __etag?: number | string;
}

export interface EstimateHubSessionInfo {
  label: string;
  value: string;
}

export interface EstimateHubSessionView {
  id: string;
  name: string;
  source: EstimateHubSessionSource | number | undefined;
  sourceData?: string | number[];
  createdAt?: string;
  createdBy?: string;
  isLegacy: boolean;
  info: EstimateHubSessionInfo[];
  /** Deep link into the Estimate hub for this session. */
  hubUrl: string;
}

export const ESTIMATE_PUBLISHER = 'ms-devlabs';
export const ESTIMATE_EXTENSION = 'estimate';
export const ESTIMATE_HUB_CONTRIBUTION = 'ms-devlabs.estimate.estimate-hub';
export const ESTIMATE_EXT_DATA_API_VERSION = '3.1-preview.1';

export function buildEstimateHubSessionUrl(
  organization: string,
  project: string,
  sessionId: string,
): string {
  const org = encodeURIComponent(organization.trim());
  const proj = encodeURIComponent(project.trim());
  const id = encodeURIComponent(sessionId.trim());
  return `https://dev.azure.com/${org}/${proj}/_apps/hub/${ESTIMATE_HUB_CONTRIBUTION}#/session/${id}`;
}

export function buildEstimateHubHomeUrl(organization: string, project: string): string {
  const org = encodeURIComponent(organization.trim());
  const proj = encodeURIComponent(project.trim());
  return `https://dev.azure.com/${org}/${proj}/_apps/hub/${ESTIMATE_HUB_CONTRIBUTION}#/`;
}
