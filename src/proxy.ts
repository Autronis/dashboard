import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/seed",
  "/api/belasting/seed",
  "/api/portal/",
  "/api/proposal/",
  "/api/tevredenheid/",
  "/api/mollie/webhook",
  "/api/screen-time/sync",
  "/api/agenda/sync",
  "/api/agenda/deadlines",
  "/api/agenda/kalenders",
  "/portal/",
  "/proposal/",
  "/feedback/",
  "/api/docs",
  "/api/ops-room/agents",
  "/api/ops-room/orchestrate",
  "/api/ops-room/execute",
  "/api/ops-room/write-files",
  "/api/assets/gallery",
  "/api/assets/file",
  "/api/assets/upload",
  "/api/bank/bonnetje",
  "/api/bank/email-factuur",
  "/api/v1/scan",
  "/api/team/sync",
  "/api/team/activiteit",
  "/api/team/live",
  "/_next",
  "/icons",
  "/manifest.json",
  "/favicon.ico",
  "/logo.png",
  "/foto-sem.jpg",
  "/foto-syb.jpg",
  "/waves.webm",
  "/bonnetjes/",
  "/api/mealplan",
  "/api/mealplan/generate",
  "/scan",
  "/api/followup/cron",
  "/api/followup/webhook",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath));
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    applyPerformanceHeaders(response, pathname);
    return response;
  }

  const response = NextResponse.next();

  try {
    const session = await getIronSession<SessionData>(req, response, sessionOptions);

    if (!session.gebruiker) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  applyPerformanceHeaders(response, pathname);
  return response;
}

function applyPerformanceHeaders(response: NextResponse, pathname: string): void {
  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Cache static assets aggressively
  if (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.endsWith(".ico")
  ) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  // Cache fonts and images
  if (/\.(woff2?|ttf|otf|eot|png|jpg|jpeg|webp|avif|svg|webm)$/.test(pathname)) {
    response.headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400");
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)",
  ],
};
