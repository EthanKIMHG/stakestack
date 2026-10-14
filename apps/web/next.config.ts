import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@stakestack/shared'],
  outputFileTracingIncludes: { '/*': ['../../catalog/**/*'] },
  experimental: { typedRoutes: false },
};
export default nextConfig;
