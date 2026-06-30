#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${CORE_URL:-http://localhost:3000}"
USERNAME="${USERNAME:-alice}"
PASSWORD="${PASSWORD:-password}"
IPS=(${IPS:-192.0.2.10 192.0.2.11 192.0.2.12 192.0.2.13})

json_value() {
  node -e "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { const data = JSON.parse(input); console.log(data$1 ?? ''); });"
}

LOGIN_RESPONSE="$(curl -sS -X POST "$CORE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")"
TOKEN="$(printf '%s' "$LOGIN_RESPONSE" | json_value "['accessToken']")"

if [ -z "$TOKEN" ]; then
  echo "FAIL login impossible"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

for ip in "${IPS[@]}"; do
  curl -sS -o /dev/null \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Forwarded-For: $ip" \
    "$CORE_URL/security/watermark" &
done
wait

sleep 1
DASHBOARD="$(curl -sS "$CORE_URL/security/dashboard")"

if printf '%s' "$DASHBOARD" | grep -q '"type":"multi_session"'; then
  echo "PASS multi-session alertee pour $USERNAME"
else
  echo "FAIL aucune alerte multi_session detectee"
  echo "$DASHBOARD"
  exit 1
fi
