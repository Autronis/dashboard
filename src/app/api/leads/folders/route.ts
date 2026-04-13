import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads, SYB_USER_ID } from "@/lib/supabase-leads";
import { requireAuth, requireApiKey } from "@/lib/auth";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await requireApiKey(req);
  } else {
    await requireAuth();
  }
}

// GET /api/leads/folders
// Alle folders + lead counts per folder (join met leads + google_maps_leads).
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);
    const supabase = getSupabaseLeads();

    // Folders ophalen
    const { data: folders, error: foldersErr } = await supabase
      .from("folders")
      .select("*")
      .order("name", { ascending: true });
    if (foldersErr) {
      return NextResponse.json(
        { fout: `Supabase error: ${foldersErr.message}` },
        { status: 500 }
      );
    }

    // Lead counts per folder — één aggregated query per tabel
    const { data: linkedinLeads } = await supabase
      .from("leads")
      .select("folder")
      .not("folder", "is", null);
    const { data: gmapsLeads } = await supabase
      .from("google_maps_leads")
      .select("folder")
      .not("folder", "is", null);

    const linkedinCounts = new Map<string, number>();
    const gmapsCounts = new Map<string, number>();
    for (const l of linkedinLeads || []) {
      if (l.folder) linkedinCounts.set(l.folder, (linkedinCounts.get(l.folder) || 0) + 1);
    }
    for (const l of gmapsLeads || []) {
      if (l.folder) gmapsCounts.set(l.folder, (gmapsCounts.get(l.folder) || 0) + 1);
    }

    const withCounts = (folders || []).map((f) => {
      const li = linkedinCounts.get(f.name) || 0;
      const gm = gmapsCounts.get(f.name) || 0;
      return { ...f, leadCountLinkedin: li, leadCountGoogleMaps: gm, leadCountTotal: li + gm };
    });

    return NextResponse.json({ folders: withCounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/leads/folders
// Body: { name: string }
export async function POST(req: NextRequest) {
  try {
    await authenticate(req);
    const body = (await req.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ fout: "name is verplicht" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();
    const { data, error } = await supabase
      .from("folders")
      .insert({ name, user_id: SYB_USER_ID })
      .select()
      .single();

    if (error) {
      if (error.message.includes("duplicate")) {
        return NextResponse.json({ fout: "Folder bestaat al" }, { status: 409 });
      }
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ folder: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PATCH /api/leads/folders
// Body: { id: string, name: string }
// Cascade rename naar leads + google_maps_leads tabellen.
export async function PATCH(req: NextRequest) {
  try {
    await authenticate(req);
    const body = (await req.json()) as { id?: string; name?: string };
    const id = body.id?.trim();
    const newName = body.name?.trim();
    if (!id || !newName) {
      return NextResponse.json(
        { fout: "id en name zijn verplicht" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseLeads();

    // Haal oude naam op voor de cascade
    const { data: existing, error: getErr } = await supabase
      .from("folders")
      .select("name")
      .eq("id", id)
      .single();
    if (getErr || !existing) {
      return NextResponse.json({ fout: "Folder niet gevonden" }, { status: 404 });
    }
    const oldName = existing.name;

    // Update folder zelf
    const { error: updateErr } = await supabase
      .from("folders")
      .update({ name: newName })
      .eq("id", id);
    if (updateErr) {
      return NextResponse.json(
        { fout: `Supabase error: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // Cascade naar leads + google_maps_leads (best effort — fouten loggen maar niet falen)
    await supabase.from("leads").update({ folder: newName }).eq("folder", oldName);
    await supabase.from("google_maps_leads").update({ folder: newName }).eq("folder", oldName);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/leads/folders
// Body: { id: string }
// Clear folder refs op leads + gmaps, dan delete row.
export async function DELETE(req: NextRequest) {
  try {
    await authenticate(req);
    const body = (await req.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    const supabase = getSupabaseLeads();

    // Haal folder op voor de naam
    const { data: existing } = await supabase
      .from("folders")
      .select("name")
      .eq("id", id)
      .single();
    if (existing?.name) {
      await supabase.from("leads").update({ folder: null }).eq("folder", existing.name);
      await supabase.from("google_maps_leads").update({ folder: null }).eq("folder", existing.name);
    }

    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
