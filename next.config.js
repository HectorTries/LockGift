/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experiments: {
    asyncWebAssembly: true,
  },
};

module.exports = nextConfig;
