import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET — contract ophalen voor publieke onderteken-pagina (geen auth vereist)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [contract] = await db
    .select({
      id: contracten.id,
      titel: contracten.titel,
      type: contracten.type,
      inhoud: contracten.inhoud,
      status: contracten.status,
      ondertekendOp: contracten.ondertekendOp,
    })
    .from(contracten)
    .where(eq(contracten.ondertekeningToken, token))
    .all();

  if (!contract) {
    return NextResponse.json({ fout: "Contract niet gevonden of link verlopen." }, { status: 404 });
  }

  return NextResponse.json({ contract });
}

// POST — ondertekenen
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [contract] = await db
    .select({ id: contracten.id, status: contracten.status })
    .from(contracten)
    .where(eq(contracten.ondertekeningToken, token))
    .all();

  if (!contract) {
    return NextResponse.json({ fout: "Contract niet gevonden." }, { status: 404 });
  }

  if (contract.status === "ondertekend") {
    return NextResponse.json({ fout: "Contract is al ondertekend." }, { status: 409 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "onbekend";

  await db.update(contracten)
    .set({
      status: "ondertekend",
      ondertekendOp: new Date().toISOString(),
      ondertekeningIp: ip,
      bijgewerktOp: new Date().toISOString(),
    })
    .where(eq(contracten.id, contract.id))
    .run();

  return NextResponse.json({ succes: true });
}
