const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";
const LOCAL_AGENT = "https://localhost:3847";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;

  // Fire request to local desktop agent (HTTPS, self-signed cert)
  try {
    const res = await fetch(`${LOCAL_AGENT}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
    });
    if (res.ok) return { succes: true };
  } catch {
    // Agent not running or cert not trusted — fallback
    window.location.href = `vscode://file${fullPath}`;
  }

  return { succes: true };
}
