const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";
const LOCAL_AGENT = "http://localhost:3847";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;

  // Try local agent first (opens new window via CLI)
  try {
    const res = await fetch(`${LOCAL_AGENT}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return { succes: true };
  } catch {
    // Agent not running — fall back to vscode:// URI (reuses window)
  }

  // Fallback: vscode://file URI (opens in existing window)
  const a = document.createElement("a");
  a.href = `vscode://file${fullPath}`;
  a.click();

  return { succes: true, fout: "Opent in bestaand venster. Start de desktop agent voor nieuw venster." };
}
