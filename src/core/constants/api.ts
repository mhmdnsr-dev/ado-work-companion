/**
 * Azure DevOps REST API constants.
 * Source of truth: https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2
 */
export const ADO_API = {
  DEFAULT_VERSION: '7.2',
  BASE_HOST_SUFFIX: 'dev.azure.com',
  /** Absolute timeout for a single outbound call (ms). */
  DEFAULT_TIMEOUT_MS: 30_000,
  /** Idempotent GETs may retry this many times on transient failures. */
  MAX_RETRIES: 2,
  RETRY_BASE_DELAY_MS: 400,
} as const;

export const ADO_HTTP_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;

export type AdoHttpMethod = (typeof ADO_HTTP_METHODS)[number];

/** JSON Patch media type required by Work Item Tracking update APIs. */
export const ADO_JSON_PATCH_CONTENT_TYPE = 'application/json-patch+json';

export const ADO_JSON_CONTENT_TYPE = 'application/json';
