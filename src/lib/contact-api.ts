/**
 * Browser helper for POST /api/contact (Message me → Resend).
 */

import {
  contactSuccessSchema,
  type ContactMessageFormValues,
  type ContactSuccess,
} from '@core/schemas';

export class ContactApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ContactApiError';
    this.status = status;
  }
}

function errorMessageFromBody(json: unknown, fallback: string): string {
  if (
    typeof json === 'object' &&
    json !== null &&
    'message' in json &&
    typeof (json as { message: unknown }).message === 'string'
  ) {
    return (json as { message: string }).message;
  }
  return fallback;
}

export async function sendContactMessage(
  payload: ContactMessageFormValues,
): Promise<ContactSuccess> {
  const response = await fetch('/api/contact', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ContactApiError(
      errorMessageFromBody(json, `Could not send message (${response.status})`),
      response.status,
    );
  }

  const parsed = contactSuccessSchema.safeParse(json);
  if (!parsed.success) {
    throw new ContactApiError('Unexpected response from contact API.', response.status);
  }

  return parsed.data;
}
