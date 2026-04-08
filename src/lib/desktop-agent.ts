const BASE_DIR = "/Users/semmiegijs/Autronis/Projects";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  const fullPath = `${BASE_DIR}/${projectDir}`;

  try {
    const res = await fetch("http://127.0.0.1:3848/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: fullPath }),
    });
    if (res.ok) return { succes: true };
    return { succes: false, fout: "Agent gaf een fout" };
  } catch {
    return { succes: false, fout: "Desktop agent niet bereikbaar" };
  }
}
