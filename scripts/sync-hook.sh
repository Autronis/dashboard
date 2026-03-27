#!/bin/bash
# Claude Code post-session hook: sync TODO.md files to dashboard
# Calls POST /api/intern/sync (localhost only, no auth needed)

DASHBOARD_URL="http://localhost:3000/api/intern/sync"

# Full scan of all project TODO.md files
curl -s -X POST "$DASHBOARD_URL" \
  -H "Content-Type: application/json" \
  -d '{}' \
  --max-time 10 \
  > /dev/null 2>&1

exit 0
