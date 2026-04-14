import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getJob } from "@/lib/auto-cluster-jobs";

// GET /api/taken/auto-cluster/status?jobId=<uuid>
// Leest de huidige status van een auto-cluster job. De frontend-poller
// in de dashboard layout hit deze elke paar seconden.

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ fout: "jobId is verplicht" }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { fout: "Job niet gevonden (mogelijk al opgeruimd)" },
        { status: 404 }
      );
    }

    // Zorg dat alleen de user die de job startte de status mag zien
    if (job.gebruikerId !== gebruiker.id) {
      return NextResponse.json({ fout: "Geen toegang" }, { status: 403 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}
