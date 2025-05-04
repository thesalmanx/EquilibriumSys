/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable TypeScript type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable ESLint blocking the build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Your existing image config
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
