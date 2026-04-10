import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kmStandFotos } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { writeFile, unlink } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const formData = await req.formData();
    const file = formData.get("foto") as File;
    const kmStandId = parseInt(formData.get("kmStandId") as string);

    if (!file || !kmStandId) {
      return NextResponse.json({ fout: "Foto en kmStandId zijn verplicht" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ fout: "Bestand mag maximaal 5MB zijn" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png"].includes(ext)) {
      return NextResponse.json({ fout: "Alleen JPEG en PNG bestanden" }, { status: 400 });
    }

    const bestandsnaam = `km-stand-${kmStandId}-${Date.now()}.${ext}`;
    const bestandspad = `/uploads/km-standen/${bestandsnaam}`;
    const fullPath = path.join(process.cwd(), "public", bestandspad);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);

    const [foto] = await db
      .insert(kmStandFotos)
      .values({
        kmStandId,
        gebruikerId: gebruiker.id,
        bestandsnaam,
        bestandspad,
      })
      .returning();

    return NextResponse.json({ foto }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const kmStandId = parseInt(new URL(req.url).searchParams.get("kmStandId") ?? "");

    if (!kmStandId) {
      return NextResponse.json({ fout: "kmStandId is verplicht" }, { status: 400 });
    }

    const foto = await db
      .select()
      .from(kmStandFotos)
      .where(
        and(
          eq(kmStandFotos.kmStandId, kmStandId),
          eq(kmStandFotos.gebruikerId, gebruiker.id)
        )
      )
      .get();

    return NextResponse.json({ foto: foto ?? null });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "");

    if (!id) return NextResponse.json({ fout: "ID is verplicht" }, { status: 400 });

    const foto = await db
      .select()
      .from(kmStandFotos)
      .where(and(eq(kmStandFotos.id, id), eq(kmStandFotos.gebruikerId, gebruiker.id)))
      .get();

    if (foto) {
      const fullPath = path.join(process.cwd(), "public", foto.bestandspad);
      await unlink(fullPath).catch(() => {});
      await db.delete(kmStandFotos).where(eq(kmStandFotos.id, id)).run();
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
