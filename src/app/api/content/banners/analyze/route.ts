import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { analyzeTopic } from "@/lib/ai/banner-generator";

interface AnalyzeBody {
  onderwerp: string;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json() as AnalyzeBody;
    const { onderwerp } = body;

    if (!onderwerp || typeof onderwerp !== "string" || onderwerp.trim().length === 0) {
      return NextResponse.json({ fout: "Onderwerp is verplicht" }, { status: 400 });
    }

    const result = await analyzeTopic(onderwerp.trim());

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
