#!/usr/bin/env node
// Autronis Desktop Agent — draait lokaal op je Mac
// Start: node scripts/desktop-agent.js
// Luistert op http://localhost:3847
// Opent VS Code in een nieuw venster wanneer het dashboard erom vraagt

const http = require("http");
const { exec } = require("child_process");

const PORT = 3847;

const server = http.createServer((req, res) => {
  // CORS headers zodat het dashboard (https://dashboard.autronis.nl) kan connecten
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/open") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { path } = JSON.parse(body);
        if (!path || path.includes("..")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ fout: "Ongeldig pad" }));
          return;
        }

        exec(`code --new-window "${path}"`, (error) => {
          if (error) {
            console.error(`Fout: ${error.message}`);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ fout: error.message }));
          } else {
            console.log(`Geopend: ${path}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ succes: true }));
          }
        });
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ fout: "Ongeldige JSON" }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`🟢 Autronis Desktop Agent draait op http://localhost:${PORT}`);
  console.log("   VS Code wordt in een nieuw venster geopend vanuit het dashboard");
});
