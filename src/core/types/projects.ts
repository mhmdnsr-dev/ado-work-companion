/**
 * TeamProjectReference / TeamProject — Azure DevOps Core Projects API.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/list?view=azure-devops-rest-7.2
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/core/projects/get?view=azure-devops-rest-7.2
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

/** Shallow team reference returned on TeamProject.defaultTeam. */
export interface WebApiTeamRef {
  id?: string;
  name?: string;
  url?: string;
}

export interface ReferenceLinks {
  links?: Record<string, { href?: string } | undefined>;
}

/**
 * Full project object from Projects - Get (includes optional capabilities).
 * `capabilities` is an opaque map (process template, version control, etc.).
 */
export interface TeamProject extends TeamProjectReference {
  _links?: ReferenceLinks;
  capabilities?: Record<string, Record<string, string> | undefined>;
  defaultTeam?: WebApiTeamRef;
}

export interface AdoListResponse<T> {
  count: number;
  value: T[];
}
