// Lichte GitHub helper — geen Octokit dependency, gewoon fetch. Wordt
// aangeroepen vanuit /api/projecten POST om een nieuwe repo op te zetten
// onder de Autronis org zodra een project wordt aangemaakt in het dashboard.
//
// Vereiste env vars:
//   GITHUB_TOKEN   — Personal Access Token met `repo` scope (classic) of
//                    fine-grained PAT met "Administration: write" + "Contents:
//                    write" voor de Autronis org
//   GITHUB_ORG     — Default "Autronis"
//
// Als GITHUB_TOKEN niet gezet is, no-op met null return — geen crash.

const GITHUB_API = "https://api.github.com";

interface CreateRepoResult {
  url: string;        // https URL voor browsing
  cloneUrl: string;   // https clone URL (incl .git)
  sshUrl: string;     // git@github.com:org/repo.git
}

function slugify(naam: string): string {
  return naam
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accenten
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled-project";
}

/**
 * Maakt een nieuwe private repo aan onder de configured org.
 * Returnt null als GITHUB_TOKEN niet gezet is of de call faalt — caller
 * moet daarop controleren en niet crashen.
 */
export async function createProjectRepo(
  naam: string,
  beschrijving?: string | null
): Promise<CreateRepoResult | null> {
  const token = process.env.GITHUB_TOKEN;
  const org = process.env.GITHUB_ORG || "Autronis";
  if (!token) return null;

  const repoName = slugify(naam);

  try {
    // Check eerst of de repo al bestaat — dan willen we hem niet opnieuw aanmaken
    const checkRes = await fetch(`${GITHUB_API}/repos/${org}/${repoName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (checkRes.ok) {
      const data = (await checkRes.json()) as {
        html_url: string;
        clone_url: string;
        ssh_url: string;
      };
      return { url: data.html_url, cloneUrl: data.clone_url, sshUrl: data.ssh_url };
    }

    // 404 → bestaat niet, ga aanmaken
    const createRes = await fetch(`${GITHUB_API}/orgs/${org}/repos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        description: beschrijving || `Autronis project: ${naam}`,
        private: true,
        auto_init: true, // initial commit met README zodat de repo direct te klonen is
        has_issues: true,
        has_projects: false,
        has_wiki: false,
      }),
    });

    if (!createRes.ok) {
      // Non-fatal — log alleen, dashboard moet niet crashen op GH falen
      const errText = await createRes.text();
      console.error("[github] createRepo failed:", createRes.status, errText.slice(0, 200));
      return null;
    }

    const data = (await createRes.json()) as {
      html_url: string;
      clone_url: string;
      ssh_url: string;
    };
    return { url: data.html_url, cloneUrl: data.clone_url, sshUrl: data.ssh_url };
  } catch (e) {
    console.error("[github] createRepo threw:", e);
    return null;
  }
}
