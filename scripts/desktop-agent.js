#!/usr/bin/env node
// Autronis Desktop Agent — draait lokaal op je Mac
// Luistert op https://localhost:3848
// Opent VS Code in een nieuw venster en plaatst ALLEEN het nieuwe venster

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

const PORT = 3848;
const CERT_DIR = path.join(require("os").homedir(), ".autronis");
const MAX_PER_SCREEN = 5;

// Get current VS Code window count
function getWindowCount() {
  try {
    const result = execSync(`osascript -e 'tell application "System Events" to tell process "Code" to return count of windows'`, { timeout: 3000 }).toString().trim();
    return parseInt(result) || 0;
  } catch {
    return 0;
  }
}

// Get screen info once
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
  set h to (item 2 of item 2 of f) as integer
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

    // Find external screens (not the MacBook at origin 0,0 with smaller width)
    const external = screens.filter(s => s.x !== 0 || s.w > 2000);
    if (external.length === 0) return { left: screens[0], right: screens[0] };

    // Sort by x position
    external.sort((a, b) => a.x - b.x);
    return {
      left: external[0],
      right: external.length > 1 ? external[1] : external[0],
    };
  } catch {
    return { left: { x: 0, y: 0, w: 1920, h: 1080 }, right: { x: 1920, y: 0, w: 1920, h: 1080 } };
  }
}

// Place ONLY the newest VS Code window (wait for it to appear)
function placeNewWindow(countBefore) {
  const screens = getScreenInfo();
  let attempts = 0;

  const check = () => {
    attempts++;
    const countNow = getWindowCount();

    if (countNow > countBefore) {
      // New window appeared! Place it.
      const leftCount = countBefore; // all existing were on left (assumption)
      let target, slotIndex;

      if (leftCount < MAX_PER_SCREEN) {
        target = screens.left;
        slotIndex = leftCount;
        const slotWidth = Math.floor(target.w / (leftCount + 1));
        // Only place the new window, don't touch others
        execSync(`osascript -e '
          tell application "System Events" to tell process "Code"
            set newWin to front window
            set position of newWin to {${target.x + slotIndex * slotWidth}, ${target.y}}
            set size of newWin to {${slotWidth}, ${target.h}}
          end tell
        '`, { timeout: 3000 });
      } else {
        target = screens.right;
        execSync(`osascript -e '
          tell application "System Events" to tell process "Code"
            set newWin to front window
            set position of newWin to {${target.x}, ${target.y}}
            set size of newWin to {${target.w}, ${target.h}}
          end tell
        '`, { timeout: 3000 });
      }

      console.log(`  Venster geplaatst op ${target === screens.left ? "links" : "rechts"}`);
    } else if (attempts < 20) {
      // Window not yet appeared, check again in 500ms
      setTimeout(check, 500);
    } else {
      console.log("  Timeout: geen nieuw venster gedetecteerd");
    }
  };

  // Start checking after 1 second
  setTimeout(check, 1000);
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

          // Count windows BEFORE opening
          const countBefore = getWindowCount();
          console.log(`Openen: ${projectPath} (${countBefore} vensters nu)`);

          exec(`/opt/homebrew/bin/code --new-window "${projectPath}"`, (error) => {
            if (error) {
              console.error(`Fout: ${error.message}`);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ fout: error.message }));
            } else {
              console.log(`  Geopend`);
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
    console.log(`🟢 Autronis Desktop Agent op https://localhost:${PORT}`);
  });
} else {
  const server = http.createServer(createHandler());
  server.listen(PORT, () => {
    console.log(`🟡 Autronis Desktop Agent op http://localhost:${PORT}`);
  });
}
