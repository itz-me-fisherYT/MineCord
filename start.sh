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

# Check npm (sometimes missing if node installed oddly)
if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm is not installed or not in PATH."
  echo "Reinstall Node.js from: https://nodejs.org/"
  exit 1
fi

# Run config check if present (make sure it's executable)
if [ -f "./check-config.sh" ]; then
  chmod +x ./check-config.sh 2>/dev/null || true
  ./check-config.sh || echo "⚠️ Config check reported issues, continuing anyway..."
else
  echo "⚠️ check-config.sh not found - skipping config validation."
fi

echo
echo "✅ Starting MineCord..."
echo

npm run dev
