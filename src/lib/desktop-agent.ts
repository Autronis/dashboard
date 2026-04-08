const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;

  // Use vscode.dev.openFolder to force a new window
  // The vscode:// URI with /openFolder and forceNewWindow query param
  const folderUri = encodeURIComponent(`file://${fullPath}`);
  const vscodeUrl = `vscode://vscode.openFolder/${folderUri}?forceNewWindow=true`;

  // Trigger without navigating the dashboard page
  const a = document.createElement("a");
  a.href = vscodeUrl;
  a.click();

  return { succes: true };
}
