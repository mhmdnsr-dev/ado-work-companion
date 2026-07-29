import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Same-origin App Router calls do not need CORS.
 * Credentialed cross-origin access requires CORS_ALLOWED_ORIGIN
 * (single origin or comma-separated list).
 */
function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  const configured = process.env.CORS_ALLOWED_ORIGIN?.trim();
  if (configured) {
    const allowed = parseAllowedOrigins(configured);
    return allowed.includes(origin) ? origin : null;
  }

  try {
    if (origin === request.nextUrl.origin) {
      return origin;
    }
  } catch {
    return null;
  }

  return null;
}

export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const allowed = resolveAllowedOrigin(request);
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', allowed);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, X-TFS-FedAuthRedirect',
  );
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

export function corsPreflightResponse(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(request, response);
}

export function jsonWithCors(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return applyCorsHeaders(request, response);
}
