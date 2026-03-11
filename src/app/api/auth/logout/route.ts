import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const response = NextResponse.json({ succes: true });
  const session = await getIronSession<SessionData>(req, response, sessionOptions);
  session.destroy();
  return response;
}
