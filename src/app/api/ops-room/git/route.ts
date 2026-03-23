import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

function getProjectDir(): string {
  return process.cwd();
}

async function git(cmd: string, cwd?: string): Promise<string> {
  const { stdout } = await execAsync(`git ${cmd}`, {
    cwd: cwd ?? getProjectDir(),
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}

// POST /api/ops-room/git
// Actions: create-branch, checkout, commit, push, create-pr, current-branch
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const body = await req.json();
    const { actie, branch, message, title, beschrijving, projectDir } = body as {
      actie: string;
      branch?: string;
      message?: string;
      title?: string;
      beschrijving?: string;
      projectDir?: string;
    };

    const cwd = projectDir ?? getProjectDir();

    switch (actie) {
      case "current-branch": {
        const current = await git("rev-parse --abbrev-ref HEAD", cwd);
        return NextResponse.json({ branch: current });
      }

      case "create-branch": {
        if (!branch) return NextResponse.json({ fout: "branch is verplicht" }, { status: 400 });
        // Fetch latest main first
        try { await git("fetch origin main", cwd); } catch { /* ok if fails */ }
        // Create branch from main
        try {
          await git(`checkout -b ${branch} origin/main`, cwd);
        } catch {
          // Branch might already exist
          await git(`checkout ${branch}`, cwd);
        }
        return NextResponse.json({ succes: true, branch });
      }

      case "checkout": {
        if (!branch) return NextResponse.json({ fout: "branch is verplicht" }, { status: 400 });
        await git(`checkout ${branch}`, cwd);
        return NextResponse.json({ succes: true, branch });
      }

      case "commit": {
        const msg = message ?? "Auto-commit by ops-room agents";
        await git("add -A", cwd);
        // Check if there are changes to commit
        try {
          const status = await git("status --porcelain", cwd);
          if (!status) {
            return NextResponse.json({ succes: true, skipped: true, message: "Geen wijzigingen" });
          }
        } catch { /* proceed */ }
        await git(`commit -m "${msg.replace(/"/g, '\\"')}"`, cwd);
        return NextResponse.json({ succes: true });
      }

      case "push": {
        const branchName = branch ?? await git("rev-parse --abbrev-ref HEAD", cwd);
        await git(`push -u origin ${branchName}`, cwd);
        return NextResponse.json({ succes: true, branch: branchName });
      }

      case "create-pr": {
        if (!branch || !title) {
          return NextResponse.json({ fout: "branch en title zijn verplicht" }, { status: 400 });
        }
        const ghPath = process.env.GH_CLI_PATH ?? `${process.env.USERPROFILE}/gh-cli/bin/gh.exe`;
        const prBody = beschrijving ?? "";
        const { stdout: prUrl } = await execAsync(
          `"${ghPath}" pr create --base main --head ${branch} --title "${title.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}"`,
          { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }
        );
        return NextResponse.json({ succes: true, prUrl: prUrl.trim() });
      }

      case "cleanup": {
        // Switch back to main after PR
        await git("checkout main", cwd);
        try { await git("pull origin main", cwd); } catch { /* ok */ }
        return NextResponse.json({ succes: true });
      }

      default:
        return NextResponse.json({ fout: `Onbekende actie: ${actie}` }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
