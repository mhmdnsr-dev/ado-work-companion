import { describe, expect, it } from 'vitest';

import { contactMessageSchema } from './contact';
import { normalizeOptionalProject } from './config';

describe('contactMessageSchema', () => {
  it('accepts a valid message', () => {
    const parsed = contactMessageSchema.safeParse({
      replyEmail: 'you@example.com',
      subject: 'Hello',
      message: 'Thanks for building this.',
      company: '',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email and empty message', () => {
    const parsed = contactMessageSchema.safeParse({
      replyEmail: 'not-an-email',
      subject: 'Hi',
      message: '   ',
    });
    expect(parsed.success).toBe(false);
  });

  it('allows honeypot text for server-side fake success', () => {
    const parsed = contactMessageSchema.safeParse({
      replyEmail: 'bot@example.com',
      subject: 'spam',
      message: 'buy now',
      company: 'Acme Corp',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.company).toBe('Acme Corp');
    }
  });
});

describe('normalizeOptionalProject', () => {
  it('turns blank project into undefined', () => {
    expect(normalizeOptionalProject('')).toBeUndefined();
    expect(normalizeOptionalProject('   ')).toBeUndefined();
    expect(normalizeOptionalProject(undefined)).toBeUndefined();
  });

  it('keeps a real project name', () => {
    expect(normalizeOptionalProject(' Contoso ')).toBe('Contoso');
  });
});
