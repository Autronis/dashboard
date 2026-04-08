#!/usr/bin/env node
// Autronis Desktop Agent
// Opent VS Code in een nieuw venster via code --new-window
// Geen window management — dat doet de gebruiker zelf of via Rectangle/Magnet

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3848;
const CERT_DIR = path.join(require("os").homedir(), ".autronis");

function createHandler() {
  return (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (req.method === "POST" && req.url === "/open") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { path: projectPath } = JSON.parse(body);
          if (!projectPath || projectPath.includes("..")) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ fout: "Ongeldig pad" }));
            return;
          }

          console.log(`Openen: ${projectPath}`);
          exec(`/opt/homebrew/bin/code --new-window "${projectPath}"`, (error) => {
            if (error) {
              console.error(`Fout: ${error.message}`);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ fout: error.message }));
            } else {
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
  };
}

const certPath = path.join(CERT_DIR, "agent-cert.pem");
const keyPath = path.join(CERT_DIR, "agent-key.pem");

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, createHandler())
    .listen(PORT, () => console.log(`🟢 Desktop Agent op https://localhost:${PORT}`));
} else {
  http.createServer(createHandler())
    .listen(PORT, () => console.log(`🟡 Desktop Agent op http://localhost:${PORT}`));
}
