import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile the shared workspace package so its TypeScript sources are bundled.
  transpilePackages: ['@scholarforge/shared'],
};

export default nextConfig;
