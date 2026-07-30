/**
 * Teams, iterations, classification nodes, and work item comments.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/teams?view=azure-devops-rest-7.2
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list?view=azure-devops-rest-7.2
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments?view=azure-devops-rest-7.2
 */

import type { ReferenceLinks } from './projects';
import type { IdentityRef } from './work-items';

export interface WebApiTeam {
  id: string;
  name: string;
  url?: string;
  description?: string;
  identityUrl?: string;
  projectName?: string;
  projectId?: string;
}

export interface TeamMember {
  isTeamAdmin?: boolean;
  identity?: IdentityRef;
}

export interface TeamSettingsIterationAttributes {
  startDate?: string | null;
  finishDate?: string | null;
  timeFrame?: 'past' | 'current' | 'future' | string;
}

export interface TeamSettingsIteration {
  id: string;
  name: string;
  path?: string;
  url?: string;
  attributes?: TeamSettingsIterationAttributes;
}

export interface TeamFieldValue {
  value: string;
  includeChildren?: boolean;
}

export interface TeamSetting {
  backlogIteration?: TeamSettingsIteration;
  defaultIteration?: TeamSettingsIteration;
  teamFieldValues?: TeamFieldValue[];
}

export interface WorkItemClassificationNode {
  id?: number;
  identifier?: string;
  name?: string;
  structureType?: 'area' | 'iteration' | string;
  hasChildren?: boolean;
  children?: WorkItemClassificationNode[];
  path?: string;
  url?: string;
  attributes?: Record<string, unknown>;
}

export interface WorkItemStateColor {
  name: string;
  color?: string;
  category?: string;
}

export interface WorkItemType {
  name: string;
  referenceName?: string;
  description?: string;
  color?: string;
  icon?: { id?: string; url?: string };
  isDisabled?: boolean;
  url?: string;
}

export interface WorkItemComment {
  id?: number;
  workItemId?: number;
  version?: number;
  text?: string;
  createdDate?: string;
  modifiedDate?: string;
  createdBy?: IdentityRef;
  modifiedBy?: IdentityRef;
  isDeleted?: boolean;
  url?: string;
  mentions?: Array<{
    artifactId?: string;
    artifactType?: string;
    targetId?: string;
  }>;
}

export interface WorkItemCommentList {
  totalCount?: number;
  count?: number;
  comments?: WorkItemComment[];
  /** Some responses use value instead of comments. */
  value?: WorkItemComment[];
  _links?: ReferenceLinks;
}

/**
 * Work item relation type (link type) definition.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-item-relation-types/list
 */
export interface WorkItemRelationTypeAttributes {
  usage?: string;
  editable?: boolean;
  enabled?: boolean;
  acyclic?: boolean;
  directional?: boolean;
  singleTarget?: boolean;
  topology?: string;
  isForward?: boolean;
  oppositeEndReferenceName?: string;
}

export interface WorkItemRelationType {
  referenceName: string;
  name: string;
  url?: string;
  attributes?: WorkItemRelationTypeAttributes;
}
