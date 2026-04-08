#!/usr/bin/env node
// Autronis Desktop Agent — draait lokaal op je Mac
// Luistert op https://localhost:3848
// Opent VS Code in een nieuw venster en tile vensters automatisch

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3848;
const CODE_PATH = "/opt/homebrew/bin/code";
const CERT_DIR = path.join(require("os").homedir(), ".autronis");

// Tile VS Code (left 60%) and Chrome/browser (right 40%) automatically
function tileAllWindows() {
  const script = `
    tell application "Finder"
      set screenBounds to bounds of window of desktop
      set screenWidth to item 3 of screenBounds
      set screenHeight to item 4 of screenBounds
    end tell

    set menuBarHeight to 25
    set winHeight to screenHeight - menuBarHeight

    -- VS Code: left 60%
    set codeWidth to (screenWidth * 0.6) as integer
    tell application "System Events"
      if exists process "Code" then
        tell process "Code"
          set winList to every window
          set winCount to count of winList
          if winCount > 0 then
            set perWin to (codeWidth / winCount) as integer
            repeat with i from 1 to winCount
              set targetWindow to item i of winList
              set position of targetWindow to {(i - 1) * perWin, menuBarHeight}
              set size of targetWindow to {perWin, winHeight}
            end repeat
          end if
        end tell
      end if

      -- Chrome: right 40%
      set browserWidth to screenWidth - codeWidth
      if exists process "Google Chrome" then
        tell process "Google Chrome"
          set winList to every window
          set winCount to count of winList
          if winCount > 0 then
            set perWin to (browserWidth / winCount) as integer
            repeat with i from 1 to winCount
              set targetWindow to item i of winList
              set position of targetWindow to {codeWidth + ((i - 1) * perWin), menuBarHeight}
              set size of targetWindow to {perWin, winHeight}
            end repeat
          end if
        end tell
      end if

      -- Safari: right 40% (if no Chrome)
      if not (exists process "Google Chrome") then
        if exists process "Safari" then
          tell process "Safari"
            set winList to every window
            set winCount to count of winList
            if winCount > 0 then
              set perWin to (browserWidth / winCount) as integer
              repeat with i from 1 to winCount
                set targetWindow to item i of winList
                set position of targetWindow to {codeWidth + ((i - 1) * perWin), menuBarHeight}
                set size of targetWindow to {perWin, winHeight}
              end repeat
            end if
          end tell
        end if
      end if
    end tell
  `;
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, () => {});
}

function createHandler() {
  return (req, res) => {
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
          const { path: projectPath } = JSON.parse(body);
          if (!projectPath || projectPath.includes("..")) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ fout: "Ongeldig pad" }));
            return;
          }

          exec(`${CODE_PATH} --new-window "${projectPath}"`, (error) => {
            if (error) {
              console.error(`Fout: ${error.message}`);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ fout: error.message }));
            } else {
              console.log(`Geopend: ${projectPath}`);
              // Tile windows after a short delay (VS Code needs time to open)
              setTimeout(tileAllWindows, 1500);
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
  const server = https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    createHandler()
  );
  server.listen(PORT, () => {
    console.log(`🟢 Autronis Desktop Agent (HTTPS) op https://localhost:${PORT}`);
  });
} else {
  const server = http.createServer(createHandler());
  server.listen(PORT, () => {
    console.log(`🟡 Autronis Desktop Agent (HTTP) op http://localhost:${PORT}`);
  });
}
