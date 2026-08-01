import { randomUUID } from 'node:crypto';

import type { NextRequest } from 'next/server';
import { Resend } from 'resend';

import { contactMessageSchema } from '@core/schemas';
import { corsPreflightResponse, jsonWithCors } from '@/lib/server/cors';
import {
  clientIpFromRequest,
  contactRateLimit,
} from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_TO = 'mhmdnsr.dev@gmail.com';
const DEFAULT_FROM = 'ADO Work Companion <onboarding@resend.dev>';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflightResponse(request);
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonWithCors(request, { message: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = contactMessageSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid contact message.';
    return jsonWithCors(request, { message }, { status: 400 });
  }

  const body = parsed.data;

  // Honeypot filled → pretend success, do not send.
  if (body.company?.trim()) {
    return jsonWithCors(request, { ok: true as const });
  }

  const ip = clientIpFromRequest(request);
  if (contactRateLimit.isLimited(ip)) {
    return jsonWithCors(
      request,
      { message: 'Too many messages. Please try again later.' },
      { status: 429 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return jsonWithCors(
      request,
      {
        message:
          'Email delivery is not configured on this server (missing RESEND_API_KEY).',
      },
      { status: 503 },
    );
  }

  const to = process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_TO;
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || DEFAULT_FROM;
  const subject = `[ADO Work] ${body.subject}`;
  const text = [
    `From: ${body.replyEmail}`,
    '',
    body.message,
    '',
    '—',
    'Sent via ADO Work Companion Message me form.',
  ].join('\n');
  const html = [
    `<p><strong>From:</strong> ${escapeHtml(body.replyEmail)}</p>`,
    `<p>${escapeHtml(body.message).replaceAll('\n', '<br />')}</p>`,
    `<hr /><p style="color:#666;font-size:12px">Sent via ADO Work Companion Message me form.</p>`,
  ].join('');

  const idempotencyKey =
    body.idempotencyKey?.trim() || `contact/${randomUUID()}`;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from,
      to: [to],
      replyTo: body.replyEmail,
      subject,
      text,
      html,
    },
    { idempotencyKey },
  );

  if (error) {
    return jsonWithCors(
      request,
      { message: 'Could not send your message. Please try again later.' },
      { status: 502 },
    );
  }

  return jsonWithCors(request, {
    ok: true as const,
    id: data?.id,
  });
}
