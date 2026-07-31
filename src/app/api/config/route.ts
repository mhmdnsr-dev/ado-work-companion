import type { NextRequest } from 'next/server';

import {
  DEFAULT_PAT_COOKIE_LIFETIME,
  isPatCookieLifetime,
  patCookieMaxAgeSeconds,
  type PatCookieLifetime,
} from '@core/constants';
import { applyCorsHeaders, corsPreflightResponse, jsonWithCors } from '@/lib/server/cors';
import {
  applyPatCookie,
  clearPatCookie,
  hasPatCookie,
  readPatFromRequest,
} from '@/lib/server/pat-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PatConfigBody {
  /** New PAT. Empty means keep existing cookie (unless `reset: true`). */
  pat?: string;
  /** When true, clears the HttpOnly PAT cookie. */
  reset?: boolean;
  /** How long the encrypted cookie should live on this device. */
  cookieLifetime?: PatCookieLifetime;
}

function resolveLifetime(raw: unknown): PatCookieLifetime {
  return isPatCookieLifetime(raw) ? raw : DEFAULT_PAT_COOKIE_LIFETIME;
}

export async function OPTIONS(request: NextRequest) {
  return corsPreflightResponse(request);
}

/**
 * PAT cookie status only — org/project/apiVersion live in client localStorage.
 */
export async function GET(request: NextRequest) {
  const hasPat = hasPatCookie(request);
  return jsonWithCors(request, { hasPat, configured: hasPat });
}

/**
 * Save PAT → encrypted HttpOnly cookie.
 * - `{ pat: "…" }` → set / replace cookie
 * - `{ pat: "" }` with existing cookie → keep value; refresh Max-Age when lifetime sent
 * - `{ reset: true }` or empty reset payload → clear cookie
 */
export async function POST(request: NextRequest) {
  let body: PatConfigBody = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as PatConfigBody;
    }
  } catch {
    return jsonWithCors(request, { message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.reset === true) {
    const response = jsonWithCors(request, {
      hasPat: false,
      configured: false,
      reset: true,
    });
    clearPatCookie(response);
    return applyCorsHeaders(request, response);
  }

  const patInput = body.pat?.trim() ?? '';
  const existingPat = readPatFromRequest(request);
  const lifetime = resolveLifetime(body.cookieLifetime);
  const maxAge = patCookieMaxAgeSeconds(lifetime);

  if (!patInput) {
    if (existingPat) {
      const response = jsonWithCors(request, {
        hasPat: true,
        configured: true,
        kept: true,
      });
      // Refresh Max-Age with the chosen lifetime while keeping the same PAT.
      applyPatCookie(response, existingPat, maxAge);
      return applyCorsHeaders(request, response);
    }
    return jsonWithCors(
      request,
      { message: 'A personal access token is required.', hasPat: false, configured: false },
      { status: 400 },
    );
  }

  const response = jsonWithCors(request, { hasPat: true, configured: true });
  applyPatCookie(response, patInput, maxAge);
  return applyCorsHeaders(request, response);
}

/** Explicit reset — clears the HttpOnly PAT cookie. */
export async function DELETE(request: NextRequest) {
  const response = jsonWithCors(request, {
    hasPat: false,
    configured: false,
    reset: true,
  });
  clearPatCookie(response);
  return applyCorsHeaders(request, response);
}
