import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads } from "@/lib/supabase-leads";
import { requireAuth, requireApiKey } from "@/lib/auth";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await requireApiKey(req);
  } else {
    await requireAuth();
  }
}

// GET /api/leads/workflow-errors
// Parity met Syb's src/pages/Errors.tsx + useWorkflowErrors hook.
// Queryt workflow_errors (latest 100) + v_errors_last_24h (totals) +
// v_error_rate_per_node (hotspots, top 10 nodes) in één call.
export async function GET(req: NextRequest) {
  try {
    await authenticate(req);
    const supabase = getSupabaseLeads();

    const [errorsRes, last24Res, ratesRes, unresolvedRes] = await Promise.all([
      supabase
        .from("workflow_errors")
        .select(
          "id, created_at, severity, workflow_name, workflow_id, node_name, node_type, error_message, error_type, http_status, lead_id, execution_id, retry_count, resolved_at, context"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("v_errors_last_24h")
        .select("id, severity"),
      supabase
        .from("v_error_rate_per_node")
        .select("node_name, errors, severity, hour"),
      supabase
        .from("workflow_errors")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null),
    ]);

    if (errorsRes.error) {
      return NextResponse.json(
        { fout: `Supabase error: ${errorsRes.error.message}` },
        { status: 500 }
      );
    }

    const errors = errorsRes.data ?? [];

    const last24Rows = last24Res.data ?? [];
    const last24h = last24Rows.length;
    const critical24h = last24Rows.filter((r) => r.severity === "critical").length;
    const unresolved = unresolvedRes.count ?? 0;

    // v_error_rate_per_node geeft aggregaties per (node, severity, hour).
    // Som errors per node, sorteer, neem top 10.
    const rateRows = ratesRes.data ?? [];
    const byNode = new Map<string, number>();
    for (const r of rateRows) {
      const key = r.node_name ?? "onbekend";
      byNode.set(key, (byNode.get(key) ?? 0) + Number(r.errors ?? 0));
    }
    const hotspots = Array.from(byNode.entries())
      .map(([node_name, total]) => ({ node_name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return NextResponse.json({
      errors,
      hotspots,
      totals: { last24h, critical24h, unresolved },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PATCH /api/leads/workflow-errors
// Body: { id: string, resolved?: boolean }
// resolved=true → resolved_at = now(), resolved=false → resolved_at = null
export async function PATCH(req: NextRequest) {
  try {
    await authenticate(req);

    const body = (await req.json()) as { id?: string; resolved?: boolean };
    if (!body.id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    const resolved_at = body.resolved === false ? null : new Date().toISOString();
    const supabase = getSupabaseLeads();
    const { error } = await supabase
      .from("workflow_errors")
      .update({ resolved_at })
      .eq("id", body.id);

    if (error) {
      return NextResponse.json(
        { fout: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, resolved_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
