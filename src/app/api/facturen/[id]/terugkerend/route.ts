import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const { actie } = await req.json();

  const factuurId = Number(id);
  if (!factuurId) {
    return NextResponse.json({ fout: "Ongeldig factuur ID" }, { status: 400 });
  }

  const [bestaand] = await db
    .select()
    .from(facturen)
    .where(eq(facturen.id, factuurId))
    .limit(1);

  if (!bestaand || !bestaand.isTerugkerend) {
    return NextResponse.json({ fout: "Factuur niet gevonden of niet terugkerend" }, { status: 404 });
  }

  if (actie === "pauzeren") {
    if (bestaand.terugkeerStatus === "gestopt") {
      return NextResponse.json({ fout: "Gestopte factuur kan niet gepauzeerd worden" }, { status: 400 });
    }
    await db.update(facturen)
      .set({ terugkeerStatus: "gepauzeerd", bijgewerktOp: new Date().toISOString() })
      .where(eq(facturen.id, factuurId));

  } else if (actie === "hervatten") {
    if (bestaand.terugkeerStatus !== "gepauzeerd") {
      return NextResponse.json({ fout: "Alleen gepauzeerde facturen kunnen hervat worden" }, { status: 400 });
    }
    const nu = new Date();
    const aantal = bestaand.terugkeerAantal || 1;
    const eenheid = bestaand.terugkeerEenheid || "maanden";
    if (eenheid === "dagen") nu.setDate(nu.getDate() + aantal);
    else if (eenheid === "weken") nu.setDate(nu.getDate() + aantal * 7);
    else if (eenheid === "maanden") nu.setMonth(nu.getMonth() + aantal);

    await db.update(facturen)
      .set({
        terugkeerStatus: "actief",
        volgendeFactuurdatum: nu.toISOString().slice(0, 10),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(facturen.id, factuurId));

  } else if (actie === "stoppen") {
    if (bestaand.terugkeerStatus === "gestopt") {
      return NextResponse.json({ fout: "Factuur is al gestopt" }, { status: 400 });
    }
    await db.update(facturen)
      .set({
        terugkeerStatus: "gestopt",
        volgendeFactuurdatum: null,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(facturen.id, factuurId));

  } else {
    return NextResponse.json({ fout: "Ongeldige actie. Gebruik: pauzeren, hervatten, stoppen" }, { status: 400 });
  }

  return NextResponse.json({ succes: true, actie });
}
