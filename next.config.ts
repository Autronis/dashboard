import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days
  },
  experimental: {
    optimizeCss: !!process.env.TURSO_DATABASE_URL,
    scrollRestoration: true,
  },
};

export default nextConfig;
