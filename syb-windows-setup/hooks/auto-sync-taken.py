#!/usr/bin/env python3
"""PostToolUse hook — automatische task sync naar Autronis Dashboard.

Triggert op:
  1. Bash (git commit) → voltooide taken syncen
  2. TodoWrite → nieuwe/geüpdatete taken syncen, met AUTO-FASE DETECTIE

Fase detectie:
  - Parseert TODO.md in cwd en haalt fase headers (## Fase X: ...) + checkbox items eruit
  - Voor elke nieuwe TodoWrite item:
    1. Exact/substring match met een bestaand checkbox item → die fase
    2. Keyword match: fase header bevat woorden uit todo titel → die fase
    3. Fallback: "huidige actieve fase" = eerste fase met onvoltooide items
  - Als geen TODO.md of geen fases gevonden → geen fase meesturen (backend fallback)
"""

import sys
import json
import re
import os
import urllib.request

# Lees config
CONFIG_PATH = os.path.expanduser("~/.config/autronis/claude-sync.json")
if not os.path.exists(CONFIG_PATH):
    sys.exit(0)

with open(CONFIG_PATH) as f:
    config = json.load(f)

URL = config.get("dashboard_url", "")
KEY = config.get("api_key", "")
if not URL or not KEY:
    sys.exit(0)

# Lees hook input
data = json.load(sys.stdin)
tool_name = data.get("tool_name", "")
tool_input = data.get("tool_input", {})
tool_response = data.get("tool_response", {})
cwd = data.get("cwd", "")


PROJECT_NAME_MAP = {
    "autronis-dashboard": "Autronis Dashboard",
    "autronis-website": "Autronis Website",
    "sales-engine": "Sales Engine",
    "investment-engine": "Investment Engine",
    "case-study-generator": "Case Study Generator",
    "speaktotext": "SpeakToText",
    "agent-office": "Agent Office / Ops Room",
    "yt-knowledge-pipeline": "YT Knowledge Pipeline",
    "automatische-followups": "Automatische Follow-ups",
    "client-health-score-dashboard": "Client Health Score Dashboard",
}


def detect_project(cwd_path):
    """Detecteer project naam uit cwd, val terug op mapped names."""
    if "/Projects/" in cwd_path:
        folder = cwd_path.split("/Projects/")[-1].split("/")[0]
        return PROJECT_NAME_MAP.get(folder, folder.replace("-", " ").title())
    elif "/Autronis" in cwd_path:
        return "Autronis Dashboard"
    return ""


def find_todo_md(cwd_path):
    """Zoek TODO.md — eerst in cwd, dan in de projectroot (één niveau hoger tot /Projects/)."""
    if not cwd_path:
        return None

    # 1. Check direct in cwd
    direct = os.path.join(cwd_path, "TODO.md")
    if os.path.exists(direct):
        return direct

    # 2. Klim omhoog tot /Projects/<project>/TODO.md
    parts = cwd_path.split(os.sep)
    try:
        proj_idx = parts.index("Projects")
        if proj_idx + 1 < len(parts):
            project_root = os.sep.join(parts[: proj_idx + 2])
            candidate = os.path.join(project_root, "TODO.md")
            if os.path.exists(candidate):
                return candidate
    except ValueError:
        pass

    return None


def parse_todo_md(todo_path):
    """Parse TODO.md → lijst van fases met (header, items, has_open_items).

    Returns:
        [
          {"header": "Fase 1: Core", "items": [("Task A", True), ("Task B", False)], "actief": False},
          ...
        ]
        where items are (titel, checked) tuples
    """
    if not todo_path or not os.path.exists(todo_path):
        return []

    try:
        with open(todo_path, encoding="utf-8") as f:
            content = f.read()
    except Exception:
        return []

    fases = []
    current_header = None
    current_items = []

    for line in content.split("\n"):
        # H2 header (## Fase X: ...)
        h2_match = re.match(r"^##\s+(.+?)\s*$", line)
        if h2_match:
            # Sla vorige fase op
            if current_header:
                fases.append({
                    "header": current_header,
                    "items": current_items,
                })
            current_header = h2_match.group(1).strip()
            current_items = []
            continue

        # Checkbox item (- [ ] or - [x])
        cb_match = re.match(r"^\s*[-*]\s*\[([ xX])\]\s+(.+?)\s*$", line)
        if cb_match and current_header:
            checked = cb_match.group(1).lower() == "x"
            titel = cb_match.group(2).strip()
            current_items.append((titel, checked))

    # Laatste fase
    if current_header:
        fases.append({
            "header": current_header,
            "items": current_items,
        })

    # Markeer de actieve fase (eerste met onvoltooide items)
    for f in fases:
        f["actief"] = any(not checked for _titel, checked in f["items"])

    return fases


STOPWORDS = {
    "het", "een", "van", "met", "aan", "voor", "door", "als", "dan",
    "the", "and", "for", "with", "this", "that", "from", "but", "not",
    "fase", "phase", "nieuw", "nieuwe", "maak", "maken", "test",
}


def extract_keywords(s):
    """Haal significante keywords uit een string.

    Behoudt woorden ≥4 chars + acroniemen (BTW, API, CSS, UI, etc.)
    Filtert stopwoorden, getallen, en generieke verbs.
    """
    normalized = re.sub(r"[^a-zA-Z0-9\s]", " ", s).strip()
    # Hoofdletters behouden voor acroniem detectie
    raw_words = normalized.split()

    keywords = set()
    for w in raw_words:
        lower = w.lower()
        # Acroniem: ≥2 chars en helemaal hoofdletters in de originele string
        is_acroniem = len(w) >= 2 and w.isupper() and w.isalpha()
        # Normaal woord: ≥4 chars
        is_long_word = len(lower) >= 4
        if (is_acroniem or is_long_word) and lower not in STOPWORDS and not lower.isdigit():
            keywords.add(lower)
    return keywords


def normalize(s):
    """Normaliseer een string voor fuzzy matching (niet-keyword use)."""
    return re.sub(r"[^a-z0-9\s]", "", s.lower()).strip()


def keyword_score(todo_title, fase_header):
    """Aantal overlappende keywords tussen todo titel en fase header."""
    title_words = extract_keywords(todo_title)
    header_words = extract_keywords(fase_header)
    if not header_words:
        return 0
    return len(title_words & header_words)


def match_fase(todo_title, fases):
    """Bepaal de beste fase voor een todo titel.

    Strategieën in volgorde:
    1. Exact/substring match op een OPEN checkbox item → sterke signal
    2. Keyword overlap op open items van actieve fases
    3. Exact/substring match op AFGERONDE items → historische context
    4. Keyword overlap op afgeronde items
    5. Fallback: eerste actieve fase (onvoltooide items)
    6. Ultimate fallback: "Lopend werk" (als alles afgerond is)
    """
    if not fases:
        return None

    todo_norm = normalize(todo_title)

    # 1. Exact / substring match op OPEN checkbox items (sterkste signal)
    for fase in fases:
        for item_titel, checked in fase["items"]:
            if checked:
                continue
            item_norm = normalize(item_titel)
            if not item_norm or len(item_norm) < 5:
                continue
            if todo_norm == item_norm:
                return fase["header"]
            if todo_norm in item_norm or item_norm in todo_norm:
                if len(todo_norm) >= 8 and len(item_norm) >= 8:
                    return fase["header"]


    # 2. Keyword overlap op actieve fases
    # Als geen enkele fase actief is (alles [x] in TODO.md), is keyword matching
    # tegen historische fases zinloos → stuur direct naar "Lopend werk"
    heeft_actieve_fase = any(f.get("actief") for f in fases)
    if not heeft_actieve_fase:
        return "Lopend werk"

    scored = []
    for idx, fase in enumerate(fases):
        if not fase.get("actief"):
            continue  # Alleen actieve fases meenemen in scoring

        header_score = keyword_score(todo_title, fase["header"]) * 3
        items_score = 0
        for item_titel, _checked in fase["items"]:
            items_score += keyword_score(todo_title, item_titel)

        total = header_score + items_score
        if total > 0:
            scored.append((total, -idx, fase["header"]))

    if scored:
        scored.sort(reverse=True)
        return scored[0][2]

    # 3. Eerste actieve fase (onvoltooide items)
    for fase in fases:
        if fase.get("actief"):
            return fase["header"]

    # 4. Als alles afgerond is: "Lopend werk" (nieuwe actieve bucket)
    return "Lopend werk"


def sync_to_dashboard(project_name, voltooide=None, nieuwe=None):
    """POST naar sync-taken API."""
    body = {"projectNaam": project_name}
    if voltooide:
        body["voltooide_taken"] = voltooide
    if nieuwe:
        body["nieuwe_taken"] = nieuwe

    req_data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{URL}/api/projecten/sync-taken",
        data=req_data,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        result = urllib.request.urlopen(req, timeout=5)
        return json.loads(result.read())
    except Exception:
        return None


# ─── GIT COMMIT → VOLTOOIDE TAKEN ───
if tool_name == "Bash":
    command = tool_input.get("command", "")
    stdout = tool_response.get("stdout", "")

    is_commit = "git commit" in command
    is_autronis = "Autronis" in cwd
    is_success = (
        bool(stdout)
        and "[" in stdout
        and ("changed" in stdout or "insertion" in stdout or "deletion" in stdout)
    )

    if not (is_commit and is_autronis and is_success):
        sys.exit(0)

    # Extract commit message
    msg_match = re.search(r'-m ["\'](.+?)["\']', command)
    if not msg_match:
        msg_match = re.search(r"<<.*?EOF\n(.+?)\n", command, re.DOTALL)
    if not msg_match:
        msg_match = re.search(r'\$\(cat <<.*?EOF\n(.+?)\n', command, re.DOTALL)

    commit_msg = msg_match.group(1).split("\n")[0].strip() if msg_match else ""
    project = detect_project(cwd)

    if commit_msg and project:
        response = sync_to_dashboard(project, voltooide=[commit_msg])
        if response:
            print(json.dumps({"systemMessage": f"Auto-sync: commit gesyncet als voltooide taak voor {project}."}))
    sys.exit(0)

# ─── TODOWRITE → NIEUWE + VOLTOOIDE TAKEN (MET FASE DETECTIE) ───
elif tool_name == "TodoWrite":
    todos = tool_input.get("todos", [])
    if not todos:
        sys.exit(0)

    project = detect_project(cwd)
    if not project:
        sys.exit(0)

    # Parse TODO.md voor fase detectie
    todo_path = find_todo_md(cwd)
    fases = parse_todo_md(todo_path)

    nieuwe = []  # List of {"titel": ..., "fase": ...}
    voltooide = []  # List of strings (titel)

    for t in todos:
        content = t.get("content", "")
        status = t.get("status", "")

        # Skip lege of te korte items
        if not content or len(content) < 5:
            continue

        if status == "completed":
            voltooide.append(content)
        elif status in ("pending", "in_progress"):
            # Slimme fase detectie
            fase = match_fase(content, fases) if fases else None
            if fase:
                nieuwe.append({"titel": content, "fase": fase})
            else:
                nieuwe.append(content)  # Fallback naar string

    if not nieuwe and not voltooide:
        sys.exit(0)

    response = sync_to_dashboard(project, voltooide=voltooide, nieuwe=nieuwe)
    if response:
        parts = []
        synced_new = response.get("added", response.get("aangemaakte_taken", 0))
        synced_done = response.get("matched", response.get("voltooide_taken", 0))
        if synced_new:
            parts.append(f"{synced_new} nieuwe taken aangemaakt")
        if synced_done:
            parts.append(f"{synced_done} taken afgerond")
        if parts:
            # Include fase info if detected
            fase_info = ""
            if fases:
                unieke_fases = {n["fase"] for n in nieuwe if isinstance(n, dict) and "fase" in n}
                if unieke_fases:
                    fase_info = f" (fases: {', '.join(sorted(unieke_fases))})"
            msg = f"Auto-sync ({project}): {', '.join(parts)}{fase_info}."
            print(json.dumps({"systemMessage": msg}))

    sys.exit(0)

else:
    sys.exit(0)
