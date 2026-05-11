import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none';",
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
];

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),  // Uncomment and add 'import path from "path"' if needed
  /* config options here */
  allowedDevOrigins: [
    '9a8651b5-91e5-46ea-abe1-6d990ef7260b.dev.coze.site',
    'vefaas-gwozwlfx-1fpxkvrzba-d7915k030ki0a103ler0-sandbox.sandbox-dev.coze-coding.bytedance.net',
    '.dev.coze.site',
    '.sandbox-dev.coze-coding.bytedance.net',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        '9a8651b5-91e5-46ea-abe1-6d990ef7260b.dev.coze.site',
        'vefaas-gwozwlfx-1fpxkvrzba-d7915k030ki0a103ler0-sandbox.sandbox-dev.coze-coding.bytedance.net',
        '.dev.coze.site',
        '.sandbox-dev.coze-coding.bytedance.net',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
