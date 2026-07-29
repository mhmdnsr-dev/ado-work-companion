/**
 * TeamProjectReference — from Azure DevOps Core Projects API.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-7.2
 */
export type ProjectState =
  'deleting' | 'new' | 'wellFormed' | 'createPending' | 'all' | 'unchanged' | 'deleted';

export type ProjectVisibility = 'private' | 'public';

export interface TeamProjectReference {
  id: string;
  name: string;
  description?: string;
  url?: string;
  state?: ProjectState;
  revision?: number;
  visibility?: ProjectVisibility;
  lastUpdateTime?: string;
  abbreviation?: string;
  defaultTeamImageUrl?: string;
}

export interface AdoListResponse<T> {
  count: number;
  value: T[];
}
