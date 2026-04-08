#!/usr/bin/env node
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

const PORT = 3848;
const CERT_DIR = path.join(require("os").homedir(), ".autronis");

function getScreenInfo() {
  try {
    const scriptPath = path.join(__dirname, "_screens.applescript");
    fs.writeFileSync(scriptPath, `
use framework "AppKit"
set screenList to current application's NSScreen's screens()
set mainH to (item 2 of item 2 of ((item 1 of screenList)'s frame())) as integer
set output to ""
repeat with s in screenList
  set f to s's frame()
  set vf to s's visibleFrame()
  set nsX to (item 1 of item 1 of f) as integer
  set w to (item 1 of item 2 of f) as integer
  set vY to (item 2 of item 1 of vf) as integer
  set vH to (item 2 of item 2 of vf) as integer
  set asVY to mainH - vY - vH
  set output to output & nsX & "," & asVY & "," & w & "," & vH & linefeed
end repeat
return output
`);
    const result = execSync(`osascript "${scriptPath}"`, { timeout: 3000 }).toString().trim();
    const screens = result.split("\n").map(line => {
      const [x, y, w, h] = line.split(",").map(Number);
      return { x, y, w, h };
    });
    const external = screens.filter(s => s.x !== 0 || s.w > 2000);
    if (external.length === 0) return { left: screens[0], right: screens[0] };
    external.sort((a, b) => a.x - b.x);
    return { left: external[0], right: external.length > 1 ? external[1] : external[0] };
  } catch {
    return { left: { x: 0, y: 0, w: 1920, h: 1080 }, right: { x: 1920, y: 0, w: 1920, h: 1080 } };
  }
}

// Get all VS Code window titles
function getWindowTitles() {
  try {
    const result = execSync(`osascript -e 'tell application "System Events" to tell process "Code" to return name of every window'`, { timeout: 3000 }).toString().trim();
    if (!result) return [];
    return result.split(", ");
  } catch {
    return [];
  }
}

// Place a specific window by matching its title
function placeWindowByTitle(folderName, screens, existingCount) {
  let attempts = 0;
  const maxAttempts = 20;

  const check = () => {
    attempts++;
    const titles = getWindowTitles();
    // Find window whose title contains the folder name
    const matchIndex = titles.findIndex(t => t.toLowerCase().includes(folderName.toLowerCase()));

    if (matchIndex >= 0) {
      const target = existingCount < 5 ? screens.left : screens.right;
      const winIndex = matchIndex + 1; // AppleScript is 1-indexed

      try {
        execSync(`osascript -e 'tell application "System Events" to tell process "Code"
          set targetWin to window ${winIndex}
          set position of targetWin to {${target.x + (existingCount < 5 ? existingCount * Math.floor(target.w / (existingCount + 1)) : 0)}, ${target.y}}
          set size of targetWin to {${existingCount < 5 ? Math.floor(target.w / (existingCount + 1)) : target.w}, ${target.h}}
        end tell'`, { timeout: 3000 });
        console.log(`  Venster "${folderName}" geplaatst`);
      } catch (e) {
        console.error(`  Fout bij plaatsen: ${e.message}`);
      }
    } else if (attempts < maxAttempts) {
      setTimeout(check, 500);
    } else {
      console.log(`  Geen venster gevonden met "${folderName}" in titel`);
    }
  };

  setTimeout(check, 2000);
}

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

          const folderName = path.basename(projectPath);
          const titlesBefore = getWindowTitles();
          const alreadyOpen = titlesBefore.some(t => t.toLowerCase().includes(folderName.toLowerCase()));
          const countBefore = titlesBefore.length;

          console.log(`Openen: ${folderName} (${countBefore} vensters, al open: ${alreadyOpen})`);

          if (alreadyOpen) {
            // Project is al open — focus het bestaande venster, niet verplaatsen
            execSync(`osascript -e 'tell application "System Events" to tell process "Code"
              set winList to name of every window
              repeat with i from 1 to count of winList
                if item i of winList contains "${folderName}" then
                  perform action "AXRaise" of window i
                  exit repeat
                end if
              end repeat
            end tell'`, { timeout: 3000 });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ succes: true, bestaand: true }));
            return;
          }

          exec(`/opt/homebrew/bin/code --new-window "${projectPath}"`, (error) => {
            if (error) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ fout: error.message }));
            } else {
              const screens = getScreenInfo();
              placeWindowByTitle(folderName, screens, countBefore);
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
    .listen(PORT, () => console.log(`🟢 Autronis Desktop Agent op https://localhost:${PORT}`));
} else {
  http.createServer(createHandler())
    .listen(PORT, () => console.log(`🟡 Autronis Desktop Agent op http://localhost:${PORT}`));
}
