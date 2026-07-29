import type { NextRequest } from 'next/server';

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
 * - `{ pat: "" }` with existing cookie → keep (client updated org/project only)
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

  if (!patInput) {
    if (existingPat) {
      return jsonWithCors(request, { hasPat: true, configured: true, kept: true });
    }
    return jsonWithCors(
      request,
      { message: 'A personal access token is required.', hasPat: false, configured: false },
      { status: 400 },
    );
  }

  const response = jsonWithCors(request, { hasPat: true, configured: true });
  applyPatCookie(response, patInput);
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
