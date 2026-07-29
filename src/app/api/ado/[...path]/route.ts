import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADO_HOST = 'dev.azure.com';
const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'content-type',
  'authorization',
  'x-tfs-fedauthredirect',
] as const;

/**
 * Server-side proxy to Azure DevOps REST API.
 * Keeps PAT out of browser→ADO cross-origin traffic and avoids CORS failures.
 *
 * Client calls: `/api/ado/{organization}/_apis/...`
 * Proxied to:   `https://dev.azure.com/{organization}/_apis/...`
 */
async function proxy(request: NextRequest, pathSegments: string[]): Promise<Response> {
  if (pathSegments.length === 0) {
    return NextResponse.json(
      { message: 'Missing Azure DevOps path. Expected /api/ado/{organization}/...' },
      { status: 400 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json(
      { message: 'Authorization header is required.' },
      { status: 401 },
    );
  }

  const targetPath = pathSegments.map(encodeURIComponent).join('/');
  const targetUrl = new URL(`https://${ADO_HOST}/${targetPath}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

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
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `Failed to reach Azure DevOps: ${error.message}`
            : 'Failed to reach Azure DevOps',
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  const activityId = upstream.headers.get('x-vms-activityid');
  if (activityId) responseHeaders.set('x-vms-activityid', activityId);
  const e2eId = upstream.headers.get('x-vss-e2eid');
  if (e2eId) responseHeaders.set('x-vss-e2eid', e2eId);

  responseHeaders.set('cache-control', 'no-store');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
