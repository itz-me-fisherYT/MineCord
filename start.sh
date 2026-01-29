#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "================================"
echo "       Starting MineCord"
echo "================================"
echo

# Check Node
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  echo "Install Node.js 18+ from: https://nodejs.org/"
  exit 1
fi

# Run config check if present
if [ -f "./check-config.sh" ]; then
  ./check-config.sh
else
  echo "⚠️ check-config.sh not found - skipping config validation."
fi

echo
echo "✅ Starting MineCord..."
echo

npm run dev
