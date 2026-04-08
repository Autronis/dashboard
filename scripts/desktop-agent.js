#!/usr/bin/env node
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3848;
const CERT_DIR = path.join(require("os").homedir(), ".autronis");
const certPath = path.join(CERT_DIR, "agent-cert.pem");
const keyPath = path.join(CERT_DIR, "agent-key.pem");

const handler = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/open") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      const { path: p } = JSON.parse(body);
      if (!p) { res.writeHead(400); res.end('{"fout":"geen pad"}'); return; }
      exec(`/opt/homebrew/bin/code --new-window "${p}"`, err => {
        res.writeHead(err ? 500 : 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(err ? { fout: err.message } : { succes: true }));
      });
    });
    return;
  }
  res.writeHead(404); res.end();
};

const opts = fs.existsSync(certPath) ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) } : null;
const server = opts ? https.createServer(opts, handler) : http.createServer(handler);
server.listen(PORT, () => console.log(`Desktop Agent op ${opts ? "https" : "http"}://localhost:${PORT}`));
