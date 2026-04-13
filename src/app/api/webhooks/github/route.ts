import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { projecten, remoteCommits, notificaties } from "@/lib/db/schema";
import { eq, or, like } from "drizzle-orm";
import { sendPushToUser } from "@/lib/push";

/**
 * POST /api/webhooks/github
 *
 * Accepteert GitHub push events, verifieert HMAC signature en schrijft
 * commits weg in `remote_commits`. Verzendt ook een notificatie naar de
 * user die NIET de auteur was, zodat Sem/Syb weten dat ze moeten pullen.
 *
 * Setup in GitHub:
 * - Repo settings → Webhooks → Add webhook
 * - URL: https://dashboard.autronis.nl/api/webhooks/github
 * - Content type: application/json
 * - Secret: waarde van GITHUB_WEBHOOK_SECRET env var
 * - Events: alleen "push"
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ fout: "Webhook secret niet geconfigureerd" }, { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256") || "";

    // Verifieer HMAC
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return NextResponse.json({ fout: "Ongeldige signature" }, { status: 401 });
    }

    const event = req.headers.get("x-github-event");
    if (event !== "push") {
      return NextResponse.json({ ok: true, skipped: event });
    }

    const payload = JSON.parse(rawBody) as {
      ref?: string;
      repository?: { html_url?: string; full_name?: string };
      commits?: Array<{
        id: string;
        message: string;
        timestamp: string;
        author?: { name?: string; email?: string };
      }>;
      pusher?: { name?: string; email?: string };
    };

    const repoUrl = payload.repository?.html_url ?? "";
    const fullName = payload.repository?.full_name ?? "";
    const branch = payload.ref?.replace("refs/heads/", "") ?? null;
    const commits = payload.commits ?? [];

    if (commits.length === 0) {
      return NextResponse.json({ ok: true, commits: 0 });
    }

    // Match met een project via github_url (zowel met als zonder .git suffix,
    // en via full_name als fallback).
    const project = await db
      .select({ id: projecten.id, naam: projecten.naam, eigenaar: projecten.eigenaar })
      .from(projecten)
      .where(
        or(
          eq(projecten.githubUrl, repoUrl),
          eq(projecten.githubUrl, repoUrl + ".git"),
          like(projecten.githubUrl, `%${fullName}%`)
        )
      )
      .get();

    const projectId = project?.id ?? null;

    // Schrijf commits weg
    for (const c of commits) {
      await db.insert(remoteCommits).values({
        projectId,
        repoUrl,
        sha: c.id,
        auteurNaam: c.author?.name ?? payload.pusher?.name ?? null,
        auteurEmail: c.author?.email ?? payload.pusher?.email ?? null,
        bericht: c.message ?? null,
        branch,
        pushedOp: c.timestamp ?? new Date().toISOString(),
      }).catch(() => {});
    }

    // Notificatie + push: alleen voor team-projecten, naar de user die niet de auteur was.
    if (project && project.eigenaar === "team") {
      const authorEmail = (commits[0]?.author?.email ?? payload.pusher?.email ?? "").toLowerCase();
      // Sem=1, Syb=2. Crude email match — kan later beter.
      const isSem = authorEmail.includes("semmiegijs") || authorEmail.includes("sem");
      const notifyUserId = isSem ? 2 : 1;
      const fromNaam = isSem ? "Sem" : "Syb";
      const titel = `${fromNaam} heeft ${commits.length} commit(s) gepusht naar ${project.naam}`;
      const preview = commits
        .slice(0, 3)
        .map((c) => `• ${c.message.split("\n")[0]}`)
        .join("\n");
      const link = `/projecten/${project.id}`;

      // In-app notificatie (verschijnt in de notificatie-bell)
      await db.insert(notificaties).values({
        gebruikerId: notifyUserId,
        type: "project_toegewezen",
        titel,
        omschrijving: preview,
        link,
      }).catch(() => {});

      // Web push notificatie (komt door op telefoon/desktop browser)
      sendPushToUser(notifyUserId, {
        titel,
        bericht: preview,
        url: link,
        tag: `github-push-${project.id}`,
      }).catch(() => {
        // Push faalt zachtjes — in-app notificatie blijft zichtbaar.
      });
    }

    return NextResponse.json({
      ok: true,
      matched: projectId !== null,
      project: project?.naam ?? null,
      commits: commits.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
