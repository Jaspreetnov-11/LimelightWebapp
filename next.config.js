/** @type {import('next').NextConfig} */
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:5000';

const nextConfig = {
  reactStrictMode: true,
  // In development the Express backend runs on its own port; proxy /api and /uploads to it.
  // On Vercel, /api/* is served by api/index.js (see vercel.json) so no rewrite is needed.
  async rewrites() {
    if (process.env.VERCEL) return [];
    return [
      { source: '/api/:path*', destination: `${API_TARGET}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_TARGET}/uploads/:path*` }
    ];
  },
  async headers() {
    return [
      { source: '/manifest.json', headers: [{ key: 'Content-Type', value: 'application/manifest+json' }] }
    ];
  }
};

module.exports = nextConfig;
