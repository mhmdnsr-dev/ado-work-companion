import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { buildPatAuthorizationHeader } from '@core/utils';

import { applyCorsHeaders, corsPreflightResponse, jsonWithCors } from '@/lib/server/cors';
import { readPatFromRequest } from '@/lib/server/pat-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXTMGMT_HOST = 'extmgmt.dev.azure.com';

/**
 * Server-side proxy to Azure DevOps Extension Management (extension data storage).
 * Used to list ms-devlabs Estimate hub sessions.
 *
 * Client calls: `/api/extmgmt/{organization}/_apis/ExtensionManagement/...`
 * Proxied to:   `https://extmgmt.dev.azure.com/{organization}/_apis/ExtensionManagement/...`
 */
async function proxy(request: NextRequest, pathSegments: string[]): Promise<Response> {
  if (pathSegments.length === 0) {
    return jsonWithCors(
      request,
      {
        message:
          'Missing Extension Management path. Expected /api/extmgmt/{organization}/_apis/...',
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
  const targetUrl = new URL(`https://${EXTMGMT_HOST}/${targetPath}`);
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
            ? `Failed to reach Extension Management: ${error.message}`
            : 'Failed to reach Extension Management',
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

export function OPTIONS(request: NextRequest) {
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

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
