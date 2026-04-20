import type { NextConfig } from 'next';
import path from 'path';
import { createMDX } from 'fumadocs-mdx/next';

const nextConfig = (): NextConfig => ({
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.externals = [...config.externals, { canvas: 'canvas' }];
    return config;
  },
  compress: true,
  skipTrailingSlashRedirect: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    qualities: [75, 100],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns',
      '@tanstack/react-query',
      'react-icons',
    ],
  },
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: 'http://localhost:8008/v1/:path*' },
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
      {
        source: '/ingest/flags',
        destination: 'https://eu.i.posthog.com/flags',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*.woff2',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
});

const withMDX = createMDX();

// Sentry + Better Stack wrappers: only apply when env vars are configured.
// Without SENTRY_DSN / LOGTAIL_TOKEN, these wrappers cause build errors.
const hasSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;
const hasBetterStack = !!process.env.LOGTAIL_SOURCE_TOKEN;

let config = withMDX(nextConfig());

if (hasBetterStack) {
  const { withBetterStack } = require('@logtail/next');
  config = withBetterStack(config);
}

if (hasSentry) {
  const { withSentryConfig } = require('@sentry/nextjs');
  config = withSentryConfig(config, {
    silent: true,
    sourcemaps: { disable: true },
    telemetry: false,
    bundleSizeOptimizations: { excludeDebugStatements: true },
    tunnelRoute: '/monitoring',
  });
}

export default config;
