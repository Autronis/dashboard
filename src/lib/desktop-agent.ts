const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;

  // Try both HTTP and HTTPS — browser may block one due to mixed content
  for (const protocol of ["https", "http"]) {
    try {
      const res = await fetch(`${protocol}://localhost:3848/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fullPath }),
      });
      if (res.ok) return { succes: true };
    } catch {
      // Try next protocol
    }
  }

  return { succes: false, fout: "Desktop agent niet bereikbaar. Start: node scripts/desktop-agent.js" };
}
