import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@stakestack/shared'],
  outputFileTracingIncludes: { '/*': ['../../catalog/**/*'] },
};
export default nextConfig;
