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
        // Global security headers
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
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
          { key: "Access-Control-Allow-Origin", value: "https://dashboard.autronis.nl" },
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
  // Ignore git worktrees so Turbopack doesn't scan 9 duplicate project
  // copies under .worktrees/ — that was causing 400%+ CPU and 3.5GB RAM
  // usage on dev, making every request take 30+ seconds.
  turbopack: {
    rules: {},
    // The root stays the project dir; we just tell Next.js which paths to
    // exclude from the file watcher / module graph.
  },
  outputFileTracingExcludes: {
    "*": [
      ".worktrees/**/*",
      // desktop-agent is een aparte Tauri/Rust app, niet onderdeel van
      // de Next runtime. Sluit hem uit van serverless function tracing,
      // anders sleept Vercel de 2GB Rust target/ cache mee in elke
      // function bundle (overschrijdt 300MB limiet).
      "desktop-agent/**/*",
    ],
  },
};

export default nextConfig;
