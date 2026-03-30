import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const SERVER_CONFIG: Record<string, { command: string; args: string[]; port: number; cwd?: string; name: string; shell?: boolean }> = {
  remotion: {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["remotion", "studio", "src/remotion/index.ts", "--port", "3001"],
    port: 3001,
    name: "Remotion Studio",
    shell: true,
  },
  "case-study": {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "dev"],
    port: 3456,
    cwd: "../autronis-case-study-generator",
    name: "Case Study Generator",
    shell: true,
  },
};

async function isPortInUse(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function waitForPort(port: number, maxWaitMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isPortInUse(port)) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

export async function POST(req: NextRequest) {
  const { server } = await req.json() as { server: string };

  const config = SERVER_CONFIG[server];
  if (!config) {
    return NextResponse.json({ fout: `Onbekende server: ${server}` }, { status: 400 });
  }

  // Check if already running
  const alreadyRunning = await isPortInUse(config.port);
  if (alreadyRunning) {
    return NextResponse.json({
      status: "running",
      url: `http://localhost:${config.port}`,
      bericht: `${config.name} draait al`,
    });
  }

  // Start the server as detached process (survives Next.js restarts)
  const cwd = config.cwd
    ? path.resolve(process.cwd(), config.cwd)
    : process.cwd();

  try {
    const child = spawn(config.command, config.args, {
      cwd,
      env: { ...process.env },
      detached: true,
      stdio: "ignore",
      shell: config.shell,
    });

    // Unref so Node.js won't wait for this process
    child.unref();

    // Wait up to 15 seconds for the server to become available
    const isUp = await waitForPort(config.port, 15000);

    return NextResponse.json({
      status: isUp ? "started" : "starting",
      url: `http://localhost:${config.port}`,
      bericht: isUp ? `${config.name} gestart op port ${config.port}` : `${config.name} wordt gestart... probeer over 10 seconden opnieuw`,
    });
  } catch (error) {
    return NextResponse.json({
      fout: error instanceof Error ? error.message : "Server starten mislukt",
    }, { status: 500 });
  }
}

// GET: check status of servers
export async function GET() {
  const statuses: Record<string, { online: boolean; url: string; name: string }> = {};

  for (const [key, config] of Object.entries(SERVER_CONFIG)) {
    const online = await isPortInUse(config.port);
    statuses[key] = { online, url: `http://localhost:${config.port}`, name: config.name };
  }

  return NextResponse.json(statuses);
}
