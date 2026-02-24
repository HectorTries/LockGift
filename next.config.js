/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };
    
    // Handle tiny-secp256k1 WASM
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    return config;
  },
};

module.exports = nextConfig;
