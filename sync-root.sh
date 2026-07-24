#!/bin/bash
# Manually trigger the Flupy Merkle root sync (bypasses the 10-min GitHub
# Actions cron interval). Useful right after telling someone to test, so
# they don't hit RootSyncError while waiting for the next scheduled sync.
#
# Usage: run from anywhere inside the repo, or set FLUPY_APP_DIR below.
#
# Requires app/.env.local to contain CRON_SECRET and VERCEL_BYPASS_SECRET.

set -euo pipefail

# Find app/.env.local relative to this script's location, or fall back
# to the current directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/app/.env.local" ]; then
  ENV_FILE="$SCRIPT_DIR/app/.env.local"
elif [ -f "./app/.env.local" ]; then
  ENV_FILE="./app/.env.local"
elif [ -f "./.env.local" ]; then
  ENV_FILE="./.env.local"
else
  echo "Could not find app/.env.local. Run this from the repo root, or edit ENV_FILE in this script." >&2
  exit 1
fi

DEPLOY_URL="https://flupy-app-dzakwannajmis-projects.vercel.app"

CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')
BYPASS_SECRET=$(grep '^VERCEL_BYPASS_SECRET=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')

if [ -z "$CRON_SECRET" ] || [ -z "$BYPASS_SECRET" ]; then
  echo "CRON_SECRET or VERCEL_BYPASS_SECRET missing/empty in $ENV_FILE" >&2
  exit 1
fi

echo "Syncing Merkle root..."
RESPONSE=$(curl -sL -X GET "$DEPLOY_URL/api/admin/sync-root" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "x-vercel-protection-bypass: $BYPASS_SECRET" \
  -w "\n%{http_code}")

BODY=$(echo "$RESPONSE" | head -n -1)
STATUS=$(echo "$RESPONSE" | tail -n 1)

echo "HTTP status: $STATUS"
echo "$BODY"

if [ "$STATUS" != "200" ]; then
  echo "Sync failed -- check the response above." >&2
  exit 1
fi