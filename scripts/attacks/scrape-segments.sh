#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${CORE_URL:-http://localhost:3000}"
HLS_URL="${HLS_URL:-http://localhost:8080/hls/poc/index.m3u8}"
USERNAME="${USERNAME:-alice}"
PASSWORD="${PASSWORD:-password}"
ATTACK_IP="${ATTACK_IP:-192.0.2.80}"
REQUESTS="${REQUESTS:-24}"

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

PLAYLIST="$(curl -fsS \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Forwarded-For: $ATTACK_IP" \
  "$HLS_URL")"

BASE_URL="${HLS_URL%/*}"
SEGMENTS=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  [[ "$line" == \#* ]] && continue
  if [[ "$line" == http* ]]; then
    SEGMENTS+=("$line")
  else
    SEGMENTS+=("$BASE_URL/$line")
  fi
done <<< "$PLAYLIST"

if [ "${#SEGMENTS[@]}" -eq 0 ]; then
  echo "FAIL aucun segment .ts dans la playlist. Lance d'abord ./scripts/encrypt-hls.sh"
  exit 1
fi

for i in $(seq 1 "$REQUESTS"); do
  index=$(( (i - 1) % ${#SEGMENTS[@]} ))
  segment_url="${SEGMENTS[$index]}"
  curl -sS -o /dev/null \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Forwarded-For: $ATTACK_IP" \
    "$segment_url"

  curl -sS -o /dev/null \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Forwarded-For: $ATTACK_IP" \
    -H "X-Original-URI: $segment_url" \
    "$CORE_URL/security/ingest"
done

sleep 1
DASHBOARD="$(curl -sS -H "Authorization: Bearer $TOKEN" "$CORE_URL/security/dashboard")"

if printf '%s' "$DASHBOARD" | grep -q '"type":"segment_scrape"'; then
  echo "PASS scraping segments alerte"
else
  echo "FAIL aucune alerte segment_scrape detectee"
  echo "$DASHBOARD"
  exit 1
fi
