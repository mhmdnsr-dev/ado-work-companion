/**
 * Normalized Azure DevOps / transport errors for UI recovery flows.
 */
export type AdoErrorKind =
  'http' | 'network' | 'timeout' | 'abort' | 'parse' | 'validation' | 'unknown';

export interface AdoErrorPayload {
  message?: string;
  typeKey?: string;
  errorCode?: number;
  eventId?: number;
  /** Present on many ADO error envelopes. */
  innerException?: unknown;
}

export class AdoClientError extends Error {
  readonly kind: AdoErrorKind;
  readonly statusCode: number | null;
  readonly requestId: string | null;
  readonly ado: AdoErrorPayload | null;
  readonly suggestions: readonly string[];
  readonly retryable: boolean;

  constructor(params: {
    message: string;
    kind: AdoErrorKind;
    statusCode?: number | null;
    requestId?: string | null;
    ado?: AdoErrorPayload | null;
    suggestions?: readonly string[];
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(
      params.message,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    );
    this.name = 'AdoClientError';
    this.kind = params.kind;
    this.statusCode = params.statusCode ?? null;
    this.requestId = params.requestId ?? null;
    this.ado = params.ado ?? null;
    this.suggestions = params.suggestions ?? [];
    this.retryable = params.retryable ?? false;
  }
}
