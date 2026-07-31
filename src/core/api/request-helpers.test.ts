import { describe, expect, it } from 'vitest';

import {
  adoFailureFromSuccessBody,
  encodeQueryResourcePath,
  parseAdoErrorBody,
  suggestionsForStatus,
} from './request-helpers';

describe('encodeQueryResourcePath', () => {
  it('encodes path segments while preserving slashes', () => {
    expect(encodeQueryResourcePath('Shared Queries/Team Board')).toBe(
      'Shared%20Queries/Team%20Board',
    );
  });

  it('encodes a plain id', () => {
    expect(encodeQueryResourcePath('abc-123')).toBe('abc-123');
  });
});

describe('parseAdoErrorBody', () => {
  it('returns null for empty body', () => {
    expect(parseAdoErrorBody('')).toBeNull();
  });

  it('parses JSON ADO error envelopes', () => {
    expect(
      parseAdoErrorBody(
        JSON.stringify({
          message: 'TF401019',
          typeKey: 'Unauthorized',
          errorCode: 401,
          eventId: 1,
        }),
      ),
    ).toEqual({
      message: 'TF401019',
      typeKey: 'Unauthorized',
      errorCode: 401,
      eventId: 1,
      innerException: undefined,
    });
  });

  it('falls back to truncated text for non-JSON', () => {
    const parsed = parseAdoErrorBody('not-json');
    expect(parsed).not.toBeNull();
    expect(parsed?.message).toBe('not-json');
  });
});

describe('adoFailureFromSuccessBody', () => {
  it('detects failure codes on 2xx envelopes', () => {
    expect(
      adoFailureFromSuccessBody({
        id: 1,
        code: 404,
        message: 'VS403145: not found',
      }),
    ).toEqual({ code: 404, message: 'VS403145: not found' });
  });

  it('ignores success-shaped bodies', () => {
    expect(adoFailureFromSuccessBody({ id: 1, fields: {} })).toBeNull();
    expect(adoFailureFromSuccessBody({ code: 200 })).toBeNull();
  });
});

describe('suggestionsForStatus', () => {
  it('returns actionable guidance for auth failures', () => {
    expect(suggestionsForStatus(401)[0]).toMatch(/Personal Access Token/i);
    expect(suggestionsForStatus(403).some((s) => /permission|Stakeholder/i.test(s))).toBe(
      true,
    );
  });

  it('handles rate limits and server errors', () => {
    expect(suggestionsForStatus(429)[0]).toMatch(/rate-limited/i);
    expect(suggestionsForStatus(503)[0]).toMatch(/unavailable|Retry/i);
  });
});
