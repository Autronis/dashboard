const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;
  const vscodeUrl = `vscode://file${fullPath}`;

  window.open(vscodeUrl, "_self");
  return { succes: true };
}
