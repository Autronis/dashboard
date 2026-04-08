const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;
  const folderUri = encodeURIComponent(`file://${fullPath}`);

  // vscode.openFolder with forceNewWindow query param
  const vscodeUrl = `vscode://vscode.openFolder?folderUri=${folderUri}&forceNewWindow=true`;

  const a = document.createElement("a");
  a.href = vscodeUrl;
  a.click();

  return { succes: true };
}
