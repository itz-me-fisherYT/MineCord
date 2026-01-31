#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "================================"
echo "   MineCord AutoStart (Laptop)"
echo "================================"
echo
echo "This mode will automatically restart MineCord if it stops."
echo "Press CTRL+C to stop completely."
echo

while true; do
  echo "[$(date)] Starting MineCord..."
  echo

  npm run dev

  echo
  echo "[$(date)] MineCord stopped."
  echo "Restarting in 10 seconds..."
  echo

  sleep 10
done
