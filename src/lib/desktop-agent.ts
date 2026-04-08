const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;

  // Local desktop agent op http://localhost:3847 (Autronis Dashboard.app)
  try {
    const res = await fetch("http://localhost:3847/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
    });
    if (res.ok) return { succes: true };
  } catch {
    // Agent niet bereikbaar
  }

  // Fallback
  window.location.href = `vscode://file${fullPath}`;
  return { succes: true };
}
