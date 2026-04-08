import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

// Only works on local dev server — Vercel has no `code` CLI
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.TURSO_DATABASE_URL) {
    return NextResponse.json({ fout: "Alleen beschikbaar op lokale dev server" }, { status: 404 });
  }

  try {
    const { path } = await req.json();

    if (!path || typeof path !== "string" || path.includes("..")) {
      return NextResponse.json({ fout: "Ongeldig pad" }, { status: 400 });
    }

    return new Promise<NextResponse>((resolve) => {
      exec(`code --new-window "${path}"`, (error) => {
        if (error) {
          resolve(NextResponse.json({ fout: error.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ succes: true }));
        }
      });
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
