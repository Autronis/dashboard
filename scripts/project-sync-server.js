#!/usr/bin/env node
// Lokale sync server die projectbestanden aanmaakt wanneer het dashboard een nieuw project start
// Draait op je Mac/PC en luistert op poort 3456
// Het dashboard stuurt een POST request met projectnaam + bestanden

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 3456;
const PROJECTS_BASE = process.platform === "win32"
  ? path.join(os.homedir(), "OneDrive", "Claude AI", "Projects")
  : path.join(os.homedir(), "Autronis", "Projects");

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Auth check
  const authHeader = req.headers["authorization"];
  const expectedToken = process.env.SESSION_SECRET || "autronis-dashboard-2026-geheim-minimaal-32-tekens!!";
  if (!authHeader || !authHeader.includes(expectedToken)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (req.method === "POST" && req.url === "/create-project") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { slug, files } = JSON.parse(body);
        const projectDir = path.join(PROJECTS_BASE, slug);

        // Maak directory aan
        fs.mkdirSync(projectDir, { recursive: true });
        fs.mkdirSync(path.join(projectDir, ".claude"), { recursive: true });

        // Schrijf bestanden
        const created = [];
        for (const [filename, content] of Object.entries(files)) {
          const filePath = path.join(projectDir, filename);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, content, "utf-8");
          created.push(filename);
        }

        console.log(`[${new Date().toISOString()}] Project aangemaakt: ${slug} (${created.length} bestanden)`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, path: projectDir, files: created }));
      } catch (e) {
        console.error("Error:", e.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Autronis Project Sync Server draait op poort ${PORT}`);
  console.log(`Projects base: ${PROJECTS_BASE}`);
});
