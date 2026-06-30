#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${CORE_URL:-http://localhost:3000}"
ATTACK_IP="${ATTACK_IP:-203.0.113.42}"
ADMIN_USER="${ADMIN_USER:-alice}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password}"

json_value() {
  node -e "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { const data = JSON.parse(input); console.log(data$1 ?? ''); });"
}

# Le dashboard est protégé (admin only) : on récupère un token admin pour le lire.
ADMIN_TOKEN="$(curl -sS -X POST "$CORE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" | json_value "['accessToken']")"

curl -sS -o /dev/null \
  -H "X-Forwarded-For: $ATTACK_IP" \
  "$CORE_URL/"

sleep 1
DASHBOARD="$(curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$CORE_URL/security/dashboard")"

if printf '%s' "$DASHBOARD" | grep -q '"type":"proxy_ip"'; then
  echo "PASS IP proxy alertee pour $ATTACK_IP"
else
  echo "FAIL aucune alerte proxy_ip detectee"
  echo "$DASHBOARD"
  exit 1
fi
