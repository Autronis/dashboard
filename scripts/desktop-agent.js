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

// Detect external monitors and tile VS Code + Chrome fullscreen on them
function tileAllWindows() {
  // Use NSScreen to find external monitors dynamically
  const script = `
    use framework "AppKit"

    set screenList to current application's NSScreen's screens()
    set mainScreen to item 1 of screenList
    set mainH to (item 2 of item 2 of (mainScreen's frame())) as integer
    set externalScreens to {}

    -- Collect external screens with correct Y conversion
    -- NSScreen Y is bottom-up, AppleScript position Y is top-down
    repeat with s in screenList
      set f to s's frame()
      set vf to s's visibleFrame()
      set nsX to (item 1 of item 1 of f) as integer
      set nsY to (item 2 of item 1 of f) as integer
      set w to (item 1 of item 2 of f) as integer
      set h to (item 2 of item 2 of f) as integer
      -- Convert NS Y (bottom-up) to AppleScript Y (top-down)
      set asY to mainH - nsY - h
      -- Visible frame for actual usable area
      set vY to (item 2 of item 1 of vf) as integer
      set vH to (item 2 of item 2 of vf) as integer
      set asVY to mainH - vY - vH

      -- Skip MacBook screen (origin 0,0 in NS coords and smaller)
      if nsX is not 0 or w > 2000 then
        set end of externalScreens to {nsX, asVY, w, vH}
      end if
    end repeat

    -- Fallback: use all screens
    if (count of externalScreens) = 0 then
      repeat with s in screenList
        set f to s's visibleFrame()
        set nsX to (item 1 of item 1 of f) as integer
        set nsY to (item 2 of item 1 of f) as integer
        set w to (item 1 of item 2 of f) as integer
        set h to (item 2 of item 2 of f) as integer
        set asY to mainH - nsY - h
        set end of externalScreens to {nsX, asY, w, h}
      end repeat
    end if

    -- Sort: screen1 = leftmost, screen2 = rightmost
    set screen1 to item 1 of externalScreens
    set screen2 to screen1
    if (count of externalScreens) > 1 then
      set screen2 to item 2 of externalScreens
      if (item 1 of screen2) < (item 1 of screen1) then
        set temp to screen1
        set screen1 to screen2
        set screen2 to temp
      end if
    end if

    tell application "System Events"
      -- VS Code: tile evenly on screen 1
      if exists process "Code" then
        tell process "Code"
          set winList to every window
          set winCount to count of winList
          if winCount > 0 then
            set sX to item 1 of screen1
            set sY to item 2 of screen1
            set sW to item 3 of screen1
            set sH to item 4 of screen1
            set perWin to (sW / winCount) as integer

            repeat with i from 1 to winCount
              set targetWindow to item i of winList
              set position of targetWindow to {sX + ((i - 1) * perWin), sY}
              set size of targetWindow to {perWin, sH}
            end repeat
          end if
        end tell
      end if

      -- Chrome/Safari: tile evenly on screen 2
      set browserProcess to "Google Chrome"
      if not (exists process "Google Chrome") then
        set browserProcess to "Safari"
      end if

      if exists process browserProcess then
        tell process browserProcess
          set winList to every window
          set winCount to count of winList
          if winCount > 0 then
            set sX to item 1 of screen2
            set sY to item 2 of screen2
            set sW to item 3 of screen2
            set sH to item 4 of screen2
            set perWin to (sW / winCount) as integer

            repeat with i from 1 to winCount
              set targetWindow to item i of winList
              set position of targetWindow to {sX + ((i - 1) * perWin), sY}
              set size of targetWindow to {perWin, sH}
            end repeat
          end if
        end tell
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
