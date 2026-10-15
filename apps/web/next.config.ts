import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@stakestack/shared'],
  outputFileTracingIncludes: { '/*': ['../../catalog/**/*', './public/logos/**/*'] },
};
export default nextConfig;
