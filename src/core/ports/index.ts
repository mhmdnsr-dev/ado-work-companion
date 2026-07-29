import type { HttpClient } from '../types/http';
import type { StorageAdapter } from './storage';

/**
 * Dependency injection surface for the shared core.
 * Construct once at app bootstrap; pass into services/hooks.
 */
export interface CorePorts {
  http: HttpClient;
  storage: StorageAdapter;
}

export type { StorageAdapter } from './storage';
