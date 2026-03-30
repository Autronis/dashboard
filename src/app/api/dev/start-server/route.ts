import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

// Track running processes
const runningServers: Record<string, { pid: number; port: number }> = {};

const SERVER_CONFIG: Record<string, { command: string; port: number; cwd?: string; name: string }> = {
  remotion: {
    command: "npx remotion studio src/remotion/index.ts --port 3001",
    port: 3001,
    name: "Remotion Studio",
  },
  "case-study": {
    command: "npm run dev",
    port: 3456,
    cwd: "../autronis-case-study-generator",
    name: "Case Study Generator",
  },
};

async function isPortInUse(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
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

  // Start the server
  const cwd = config.cwd
    ? path.resolve(process.cwd(), config.cwd)
    : process.cwd();

  try {
    const child = exec(config.command, { cwd, env: { ...process.env } });
    if (child.pid) {
      runningServers[server] = { pid: child.pid, port: config.port };
    }

    // Wait a bit for server to start
    await new Promise(r => setTimeout(r, 3000));

    const isUp = await isPortInUse(config.port);

    return NextResponse.json({
      status: isUp ? "started" : "starting",
      url: `http://localhost:${config.port}`,
      bericht: isUp ? `${config.name} gestart` : `${config.name} wordt gestart...`,
      pid: child.pid,
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
