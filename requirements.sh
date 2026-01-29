#!/usr/bin/env bash
set -e

echo "================================"
echo "   MineCord Setup (One-Time)"
echo "================================"
echo

# Check Node
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is NOT installed."
  echo "Install Node.js 18+ from: https://nodejs.org/"
  exit 1
fi

echo "✅ Node.js detected: $(node -v)"
echo

echo "Installing npm dependencies..."
npm install

echo
echo "✅ Setup complete!"
echo
echo "Next steps:"
echo "1) Configure .env (Discord token)"
echo "2) Create bots.json (multi-bot mode) or use .env fallback"
echo "3) Run ./start.sh"
