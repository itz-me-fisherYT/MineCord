#!/usr/bin/env bash
set -e

echo "================================"
echo "       Starting MineCord"
echo "================================"
echo

# Move to script directory
cd "$(dirname "$0")"

# Optional: warn if .env missing
if [ ! -f ".env" ]; then
  echo "⚠️  .env not found!"
  echo "   MineCord may fail to start."
  echo
fi

# Start app
npm run dev

echo
echo "MineCord has stopped."
read -r -p "Press Enter to exit..." _
