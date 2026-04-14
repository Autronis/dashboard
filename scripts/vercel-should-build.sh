#!/bin/bash
# Vercel ignored build step.
# Exit 0 = skip build (geen wijzigingen die de app raken)
# Exit 1 = build (er zijn echte code wijzigingen)
#
# Activeren in Vercel:
# Settings → Git → Ignored Build Step → Custom → `bash scripts/vercel-should-build.sh`
#
# Skip regels:
# - Alleen *.md, .txt, docs/, scripts/, .gitignore, .vscode/ wijzigingen → SKIP
# - Auto-sync commits zonder src/ wijzigingen → SKIP
# - Alle andere wijzigingen (src/, public/, package.json, vercel.json, etc) → BUILD

set -e

# Wijzigingen sinds de vorige commit op deze branch
CHANGED=$(git diff --name-only HEAD^ HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED" ]; then
  # Geen diff te bepalen (eerste commit, etc) → veiligheidshalve builden
  echo "No diff available — building"
  exit 1
fi

echo "Changed files:"
echo "$CHANGED" | sed 's/^/  /'

# Tel files die NIET in de skip-patterns vallen
RELEVANT=0
while IFS= read -r file; do
  case "$file" in
    *.md|*.txt) ;;
    docs/*|scripts/*|.vscode/*|.idea/*|.gitignore|README*|LICENSE*|CHANGELOG*) ;;
    HANDOFF.md|TODO.md|CLAUDE.md) ;;
    *)
      RELEVANT=$((RELEVANT + 1))
      echo "  → relevant: $file"
      ;;
  esac
done <<< "$CHANGED"

if [ "$RELEVANT" -eq 0 ]; then
  echo "✋ Geen relevante wijzigingen — skip build"
  exit 0
fi

echo "✅ $RELEVANT relevante wijziging(en) — build doorgaan"
exit 1
