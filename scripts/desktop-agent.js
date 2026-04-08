#!/usr/bin/env node
// Autronis Desktop Agent
// Opent VS Code in een nieuw venster via code --new-window
// Verplaatst ALLEEN het nieuwe venster nadat het verschijnt

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

const PORT = 3848;
const CERT_DIR = path.join(require("os").homedir(), ".autronis");

// Save positions of all existing windows BEFORE opening
function saveExistingPositions() {
  try {
    const result = execSync(`osascript -e 'tell application "System Events" to tell process "Code"
      set winList to every window
      set output to ""
      repeat with w in winList
        set n to name of w
        set p to position of w
        set s to size of w
        set output to output & n & "|" & (item 1 of p) & "," & (item 2 of p) & "," & (item 1 of s) & "," & (item 2 of s) & linefeed
      end repeat
      return output
    end tell'`, { timeout: 3000 }).toString().trim();
    if (!result) return [];
    return result.split("\n").map(line => {
      const [name, coords] = line.split("|");
      const [x, y, w, h] = coords.split(",").map(Number);
      return { name, x, y, w, h };
    });
  } catch {
    return [];
  }
}

// Restore positions of all windows that were saved (undo any VS Code reshuffling)
function restoreAndPlaceNew(saved, folderName) {
  let attempts = 0;

  const check = () => {
    attempts++;
    try {
      // Get current window list
      const result = execSync(`osascript -e 'tell application "System Events" to tell process "Code" to return name of every window'`, { timeout: 3000 }).toString().trim();
      const currentTitles = result ? result.split(", ") : [];

      // Find the new window (title contains folder name, wasn't in saved list)
      const savedNames = saved.map(s => s.name);
      const newWinTitle = currentTitles.find(t =>
        t.toLowerCase().includes(folderName.toLowerCase()) && !savedNames.includes(t)
      );

      if (newWinTitle) {
        // First: restore ALL existing windows to their original positions
        for (const s of saved) {
          const idx = currentTitles.indexOf(s.name);
          if (idx >= 0) {
            try {
              execSync(`osascript -e 'tell application "System Events" to tell process "Code"
                set targetWin to window ${idx + 1}
                set position of targetWin to {${s.x}, ${s.y}}
                set size of targetWin to {${s.w}, ${s.h}}
              end tell'`, { timeout: 3000 });
            } catch {}
          }
        }

        // Then: place the NEW window next to existing ones
        // Find rightmost existing window to place new one after it
        let nextX = 0;
        if (saved.length > 0) {
          const rightmost = saved.reduce((max, s) => s.x + s.w > max ? s.x + s.w : max, 0);
          nextX = rightmost;
        }

        const newIdx = currentTitles.indexOf(newWinTitle);
        if (newIdx >= 0) {
          execSync(`osascript -e 'tell application "System Events" to tell process "Code"
            set targetWin to window ${newIdx + 1}
            set position of targetWin to {${nextX}, 0}
            set size of targetWin to {960, 1080}
          end tell'`, { timeout: 3000 });
        }

        console.log(`  Nieuw venster "${folderName}" geplaatst op x=${nextX}`);
      } else if (attempts < 15) {
        setTimeout(check, 500);
      } else {
        console.log(`  Timeout: "${folderName}" niet gevonden`);
      }
    } catch (e) {
      if (attempts < 15) setTimeout(check, 500);
    }
  };

  setTimeout(check, 1500);
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

          // Save ALL current window positions before VS Code messes them up
          const saved = saveExistingPositions();
          console.log(`Openen: ${folderName} (${saved.length} bestaande vensters)`);

          exec(`/opt/homebrew/bin/code --new-window "${projectPath}"`, (error) => {
            if (error) {
              console.error(`Fout: ${error.message}`);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ fout: error.message }));
            } else {
              // Restore existing windows + place new one
              restoreAndPlaceNew(saved, folderName);
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
