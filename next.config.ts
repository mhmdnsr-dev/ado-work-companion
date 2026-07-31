import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

/**
 * The PAT is forwarded from the browser to our own Route Handler proxy and must
 * never be cached, logged by an intermediary, or leaked through a referrer.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  fallbacks: {
    document: '/offline',
  },
  // Prepend NetworkOnly for /api so PAT-backed proxies are never Workbox-cached.
  // Matching cacheName "apis" replaces the default NetworkFirst /api/ rule.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin, url: { pathname } }) =>
          Boolean(sameOrigin && pathname.startsWith('/api/')),
        handler: 'NetworkOnly',
        method: 'GET',
        options: {
          cacheName: 'apis',
        },
      },
      {
        urlPattern: ({ sameOrigin, url: { pathname } }) =>
          Boolean(sameOrigin && pathname.startsWith('/api/')),
        handler: 'NetworkOnly',
        method: 'POST',
        options: {
          cacheName: 'apis-mutating',
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Allows the service worker to control the whole origin.
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
