const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";
const LOCAL_AGENT = "http://127.0.0.1:3847";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;

  // Fire and forget — don't wait for response
  fetch(`${LOCAL_AGENT}/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fullPath }),
    mode: "cors",
  }).catch(() => {
    // Agent not running — fallback to vscode:// URI
    window.location.href = `vscode://file${fullPath}`;
  });

  return { succes: true };
}
