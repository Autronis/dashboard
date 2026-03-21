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
  "/_next",
  "/icons",
  "/manifest.json",
  "/favicon.ico",
  "/logo.png",
  "/foto-sem.jpg",
  "/foto-syb.jpg",
  "/waves.webm",
  "/bonnetjes/",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath));
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)",
  ],
};
