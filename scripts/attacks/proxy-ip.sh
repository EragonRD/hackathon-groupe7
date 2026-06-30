#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${CORE_URL:-http://localhost:3000}"
ATTACK_IP="${ATTACK_IP:-203.0.113.42}"

curl -sS -o /dev/null \
  -H "X-Forwarded-For: $ATTACK_IP" \
  "$CORE_URL/"

sleep 1
DASHBOARD="$(curl -sS "$CORE_URL/security/dashboard")"

if printf '%s' "$DASHBOARD" | grep -q '"type":"proxy_ip"'; then
  echo "PASS IP proxy alertee pour $ATTACK_IP"
else
  echo "FAIL aucune alerte proxy_ip detectee"
  echo "$DASHBOARD"
  exit 1
fi
