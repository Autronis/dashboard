import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// SSE endpoint — streams agent updates every 3 seconds
// Replaces the 5s polling approach with real-time push
export async function GET(req: NextRequest) {
  // EventSource can't set headers, so also accept token via query param
  const token = req.headers.get("x-ops-token") ?? req.nextUrl.searchParams.get("token");
  if (token !== OPS_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const fetchAndSend = async () => {
        if (closed) return;
        try {
          const now = new Date();
          const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
          const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
          const vandaag = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

          // Update stale statuses
          try {
            await db.run(sql`UPDATE agent_activiteit SET status = 'offline' WHERE laatst_gezien < ${thirtyMinAgo} AND status IN ('actief', 'inactief')`);
            await db.run(sql`UPDATE agent_activiteit SET status = 'inactief' WHERE laatst_gezien < ${fiveMinAgo} AND status = 'actief'`);
          } catch { /* table might not exist */ }

          const agents = await db.all(sql`
            SELECT id, agent_id as agentId, agent_type as agentType, project,
                   laatste_actie as laatsteActie, details, status,
                   tokens_gebruikt as tokensGebruikt,
                   laatst_gezien as laatstGezien, aangemaakt_op as aangemaaktOp
            FROM agent_activiteit
            WHERE aangemaakt_op >= ${vandaag} OR status IN ('actief', 'inactief')
            ORDER BY laatst_gezien DESC
          `);

          send({ type: "agents", agents });

          // Worker progress: stream task statuses from active worker runs
          try {
            const activeWorkers = await db.all(sql`
              SELECT wr.command_id, wr.status as worker_status, wr.huidige_taak_id, wr.worker_token,
                     wr.poging, wr.fout, wr.laatste_heartbeat,
                     oc.opdracht, oc.plan_json, oc.status as command_status
              FROM worker_runs wr
              JOIN orchestrator_commands oc ON oc.id = wr.command_id
              WHERE wr.status IN ('running', 'paused')
              ORDER BY wr.id DESC
            `);

            if (activeWorkers.length > 0) {
              const workerProgress = (activeWorkers as Record<string, unknown>[]).map((w) => {
                let taken: { id: string; titel: string; status: string; agentId: string | null }[] = [];
                try {
                  const plan = JSON.parse(w.plan_json as string);
                  taken = (plan.taken ?? []).map((t: Record<string, unknown>) => ({
                    id: t.id,
                    titel: t.titel,
                    status: t.status,
                    agentId: t.agentId,
                  }));
                } catch {/* invalid json */}

                return {
                  commandId: w.command_id,
                  opdracht: w.opdracht,
                  workerStatus: w.worker_status,
                  commandStatus: w.command_status,
                  huidigeTaakId: w.huidige_taak_id,
                  poging: w.poging,
                  fout: w.fout,
                  laatsteHeartbeat: w.laatste_heartbeat,
                  taken,
                };
              });

              send({ type: "worker_progress", workers: workerProgress });
            }
          } catch {/* worker_runs table might not exist yet */}
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }
      };

      // Send initial data immediately
      await fetchAndSend();

      // Then stream every 3 seconds
      const interval = setInterval(fetchAndSend, 3000);

      // Cleanup on abort
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
