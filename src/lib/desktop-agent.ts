const AGENT_URL = "http://localhost:3847";

export async function openProjectInVSCode(projectDir: string): Promise<{ succes: boolean; fout?: string }> {
  try {
    const res = await fetch(`${AGENT_URL}/open-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: projectDir }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { succes: false, fout: data.fout ?? "Desktop agent gaf een fout" };
    }
    return { succes: true };
  } catch {
    return { succes: false, fout: "Desktop agent is niet bereikbaar. Draait de agent?" };
  }
}
