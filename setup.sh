#!/usr/bin/env bash
set -euo pipefail

echo "================================"
echo "   MineCord Setup (One-Time)"
echo "================================"
echo

# Move to script directory
cd "$(dirname "$0")"

# --- Check Node.js ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is NOT installed."
  echo "Install Node.js 18+ from:"
  echo "https://nodejs.org/"
  echo
  exit 1
fi

NODEVER="$(node -v 2>/dev/null || true)"
echo "✅ Node.js detected: ${NODEVER}"
echo

# --- Install dependencies ---
echo "Installing npm dependencies..."
npm install
echo
echo "✅ npm dependencies installed."
echo

# --- .env helper ---
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
    echo "✅ Created .env from .env.example"
  else
    echo "⚠️  .env not found."
    echo "    Create a .env file with your DISCORD_TOKEN etc."
  fi
else
  echo "✅ .env found."
fi

# --- bots.json check ---
if [ -f "bots.json" ]; then
  echo "✅ bots.json found (multi-bot mode ready)."
else
  echo "⚠️  bots.json not found (single-bot mode unless you add it)."
fi

echo
echo "--- LAN Info (for phone/other PC) ---"
PORT="${PANEL_PORT:-3000}"
echo "Your panel runs on port ${PORT} by default."
echo "Use one of these on other devices (same network):"
echo

# macOS: ipconfig getifaddr
# We try common interfaces (en0 = Wi-Fi, en1 = sometimes Wi-Fi on older Macs)
IPS=()
for IFACE in en0 en1; do
  IP="$(ipconfig getifaddr "$IFACE" 2>/dev/null || true)"
  if [ -n "${IP}" ]; then IPS+=("${IP}"); fi
done

# Fallback: parse ifconfig (covers weird setups)
if [ "${#IPS[@]}" -eq 0 ]; then
  while IFS= read -r line; do
    IP="$(echo "$line" | awk '{print $2}')"
    if [ -n "${IP}" ]; then IPS+=("${IP}"); fi
  done < <(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print}')
fi

if [ "${#IPS[@]}" -eq 0 ]; then
  echo "⚠️  Could not detect LAN IP automatically."
  echo "    Run: ipconfig getifaddr en0"
else
  for IP in "${IPS[@]}"; do
    echo "  http://${IP}:${PORT}"
  done
fi

echo
echo "✅ Setup complete!"
echo
echo "Next steps:"
echo "1. Edit .env (Discord token, channel id, MC host/user)"
echo "2. (Optional) Create bots.json (for multi-bot mode)"
echo "3. Run start.sh"
echo

# Optional: open current folder in Finder on macOS
if command -v open >/dev/null 2>&1; then
  echo "Opening folder in Finder..."
  open .
fi

echo
read -r -p "Press Enter to exit..." _
