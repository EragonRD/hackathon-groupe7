#!/usr/bin/env bash
# ============================================================================
# dev-mobile.sh — Lance le stack de dev pour la branche mobile.
#   1. Backend Core (NestJS, port 3000, watch)
#   2. App mobile (Expo)
# Detecte l'IP LAN, la synchronise dans mobile/.env, installe les deps si besoin.
# Ctrl+C coupe proprement les deux process.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
MOBILE="$ROOT/mobile"

# --- IP LAN (surchargeable : LAN_IP=x.x.x.x ./scripts/dev-mobile.sh) ---------
LAN_IP="${LAN_IP:-$(hostname -I | awk '{print $1}')}"
if [ -z "$LAN_IP" ]; then
  echo "[!] Impossible de detecter l'IP LAN. Relance avec LAN_IP=<ip> $0" >&2
  exit 1
fi
echo "[i] IP LAN : $LAN_IP"

# --- Sync mobile/.env -------------------------------------------------------
cat > "$MOBILE/.env" <<EOF
# Config Expo (auto-generee par scripts/dev-mobile.sh).
EXPO_PUBLIC_API_URL=http://$LAN_IP:3000
EXPO_PUBLIC_COLLAB_MODE=socket
EOF
echo "[i] mobile/.env synchronise -> http://$LAN_IP:3000"

# --- Install deps si absentes -----------------------------------------------
[ -d "$BACKEND/node_modules" ] || (echo "[i] npm install backend..." && cd "$BACKEND" && npm install)
[ -d "$MOBILE/node_modules" ]  || (echo "[i] npm install mobile..."  && cd "$MOBILE"  && npm install)

# --- Arret propre -----------------------------------------------------------
PIDS=()
cleanup() {
  echo -e "\n[i] Arret..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# --- Backend ----------------------------------------------------------------
echo "[i] Demarrage backend (http://$LAN_IP:3000)..."
( cd "$BACKEND" && npm run start:dev ) &
PIDS+=($!)

# --- Mobile -----------------------------------------------------------------
echo "[i] Demarrage Expo... (a=Android, i=iOS, scan QR=Expo Go)"
( cd "$MOBILE" && npm start ) &
PIDS+=($!)

wait
