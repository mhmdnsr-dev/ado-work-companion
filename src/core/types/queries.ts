/**
 * Saved work item queries — Azure DevOps WIT Queries API.
 * @see https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/queries/list?view=azure-devops-rest-7.2
 */

import type { IdentityRef } from './work-items';
import type { ReferenceLinks } from './projects';

export type QueryType = 'flat' | 'tree' | 'oneHop';

export type QueryExpand = 'None' | 'Wiql' | 'Clauses' | 'All' | 'Minimal';

export interface QueryHierarchyItem {
  id: string;
  name: string;
  path?: string;
  createdBy?: IdentityRef;
  createdDate?: string;
  lastModifiedBy?: IdentityRef;
  lastModifiedDate?: string;
  isFolder?: boolean;
  hasChildren?: boolean;
  children?: QueryHierarchyItem[];
  isDeleted?: boolean;
  isPublic?: boolean;
  queryType?: QueryType;
  wiql?: string;
  _links?: ReferenceLinks;
  url?: string;
}
