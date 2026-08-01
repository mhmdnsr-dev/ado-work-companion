import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { buildPatAuthorizationHeader } from '@core/utils';

import { applyCorsHeaders, corsPreflightResponse, jsonWithCors } from '@/lib/server/cors';
import { readPatFromRequest } from '@/lib/server/pat-cookie';
import {
  adoProxyRateLimit,
  clientIpFromRequest,
} from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ANALYTICS_HOST = 'analytics.dev.azure.com';

/**
 * Server-side proxy to Azure DevOps Analytics OData.
 * PAT is decrypted from the HttpOnly `ado_pat` cookie — never from the browser body.
 *
 * Client calls: `/api/analytics/{organization}/{project}/_odata/...`
 * Proxied to:   `https://analytics.dev.azure.com/{organization}/{project}/_odata/...`
 *
 * Requires PAT scope: Analytics (read).
 */
async function proxy(request: NextRequest, pathSegments: string[]): Promise<Response> {
  const ip = clientIpFromRequest(request);
  if (adoProxyRateLimit.isLimited(ip)) {
    return jsonWithCors(
      request,
      { message: 'Too many requests. Please try again shortly.' },
      { status: 429 },
    );
  }

  if (pathSegments.length === 0) {
    return jsonWithCors(
      request,
      {
        message:
          'Missing Analytics path. Expected /api/analytics/{organization}/{project}/_odata/...',
      },
      { status: 400 },
    );
  }

  const pat = readPatFromRequest(request);
  if (!pat) {
    return jsonWithCors(
      request,
      {
        message: 'No access token found. Please save your connection settings first.',
        hasPat: false,
        configured: false,
      },
      { status: 401 },
    );
  }

  const targetPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/');
  const targetUrl = new URL(`https://${ANALYTICS_HOST}/${targetPath}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers = new Headers();
  headers.set('Accept', request.headers.get('accept') ?? 'application/json');
  headers.set('Authorization', buildPatAuthorizationHeader(pat));
  headers.set('X-TFS-FedAuthRedirect', 'Suppress');

  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (error) {
    return jsonWithCors(
      request,
      {
        message:
          error instanceof Error
            ? `Failed to reach Azure DevOps Analytics: ${error.message}`
            : 'Failed to reach Azure DevOps Analytics',
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get('content-type');
  if (upstreamContentType) responseHeaders.set('content-type', upstreamContentType);

  const activityId = upstream.headers.get('x-vms-activityid');
  if (activityId) responseHeaders.set('x-vms-activityid', activityId);
  const e2eId = upstream.headers.get('x-vss-e2eid');
  if (e2eId) responseHeaders.set('x-vss-e2eid', e2eId);

  responseHeaders.set('cache-control', 'no-store');

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });

  return applyCorsHeaders(request, response);
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function OPTIONS(request: NextRequest) {
  return corsPreflightResponse(request);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
