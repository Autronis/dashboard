import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "web-push"],
  async headers() {
    return [
      {
        // Allow live dashboard to call localhost API for video rendering
        source: "/api/content/videos/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://dashboard.autronis.nl" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
      {
        source: "/api/dev/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://dashboard.autronis.nl" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        // Allow video files to be served cross-origin
        source: "/videos/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
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
