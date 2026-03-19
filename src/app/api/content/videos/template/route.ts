import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentVideos } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { VIDEO_TEMPLATES } from "@/lib/ai/video-templates";
import { generateFromTemplate } from "@/lib/ai/video-template-generator";

export async function GET() {
  try {
    await requireAuth();

    const templates = VIDEO_TEMPLATES.map((t) => ({
      id: t.id,
      naam: t.naam,
      beschrijving: t.beschrijving,
      categorie: t.categorie,
      icon: t.icon,
      velden: t.velden,
      voorbeeldInput: t.voorbeeldInput,
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json() as {
      templateId: string;
      input: Record<string, string>;
      titel?: string;
    };

    const { templateId, input, titel } = body;

    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json({ fout: "templateId is verplicht" }, { status: 400 });
    }

    if (!input || typeof input !== "object") {
      return NextResponse.json({ fout: "input is verplicht" }, { status: 400 });
    }

    const template = VIDEO_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ fout: `Template '${templateId}' niet gevonden` }, { status: 404 });
    }

    const scenes = await generateFromTemplate(templateId, input);

    const totaalSeconden = scenes.reduce((sum, scene) => sum + (scene.duur ?? 3), 0);

    const videoTitel = titel ?? `${template.naam}: ${input[template.velden[0]?.key ?? ""] ?? "Video"}`;

    const result = await db
      .insert(contentVideos)
      .values({
        postId: null,
        script: JSON.stringify(scenes),
        status: "script",
        duurSeconden: totaalSeconden,
        titel: videoTitel,
        templateId: templateId,
      })
      .returning()
      .get();

    return NextResponse.json({
      video: {
        id: result.id,
        script: scenes,
        status: result.status,
        duurSeconden: result.duurSeconden,
        postId: null,
        titel: videoTitel,
        templateId: templateId,
        aangemaaktOp: result.aangemaaktOp,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
