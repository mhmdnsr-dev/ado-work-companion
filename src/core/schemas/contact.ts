import { z } from 'zod';

export const CONTACT_SUBJECT_MAX = 200;
export const CONTACT_MESSAGE_MAX = 5000;

/**
 * Contact / “Message me” form payload.
 * `company` is a honeypot — humans leave it blank; non-empty values are
 * accepted by Zod so the API can return a fake success without sending mail.
 */
export const contactMessageSchema = z.object({
  replyEmail: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(254, 'Email is too long'),
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required')
    .max(CONTACT_SUBJECT_MAX, `Subject must be at most ${CONTACT_SUBJECT_MAX} characters`),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(CONTACT_MESSAGE_MAX, `Message must be at most ${CONTACT_MESSAGE_MAX} characters`),
  /** Honeypot — leave blank. */
  company: z.string().max(200).optional(),
  /** Optional client idempotency key for Resend. */
  idempotencyKey: z.string().trim().max(256).optional(),
});

export type ContactMessageFormValues = z.infer<typeof contactMessageSchema>;

/** Successful /api/contact response. */
export const contactSuccessSchema = z.object({
  ok: z.literal(true),
  id: z.string().optional(),
});

export type ContactSuccess = z.infer<typeof contactSuccessSchema>;
