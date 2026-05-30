#!/usr/bin/env bash
# scripts/setup-schedule.sh — install the 9am/2pm launchd job
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
: "${LINEAR_API_KEY:?Set LINEAR_API_KEY in your environment first}"
DEST="$HOME/Library/LaunchAgents/com.ada.teamstatus.plist"

sed -e "s|__PROJECT__|$PROJECT|g" \
    -e "s|__LINEAR_API_KEY__|$LINEAR_API_KEY|g" \
    "$PROJECT/scripts/com.ada.teamstatus.plist" > "$DEST"

launchctl unload "$DEST" 2>/dev/null || true
launchctl load "$DEST"
echo "Installed. Runs daily at 09:00 and 14:00. Dashboard: $PROJECT/dashboard.html"
echo "Test now with: launchctl start com.ada.teamstatus"
