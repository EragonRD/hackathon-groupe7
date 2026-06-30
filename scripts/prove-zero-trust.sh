#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
USERNAME="${USERNAME:-alice}"
PASSWORD="${PASSWORD:-password}"
JWT_SECRET_VALUE="${JWT_SECRET:-dev-secret-change-me}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

json_value() {
  node -e "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { try { const data = JSON.parse(input); console.log(data$1 ?? ''); } catch { process.exit(1); } });"
}

expect_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo "PASS $label -> HTTP $actual"
  else
    echo "FAIL $label -> HTTP $actual, attendu $expected"
    FAILURES=$((FAILURES + 1))
  fi
}

LOGIN_RESPONSE="$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")"

TOKEN="$(printf '%s' "$LOGIN_RESPONSE" | json_value "['accessToken']")"

if [ -z "$TOKEN" ]; then
  echo "FAIL login impossible sur $BASE_URL/auth/login"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

TMP_KEY="$(mktemp)"
WITH_TOKEN_STATUS="$(curl -sS -o "$TMP_KEY" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/keys/poc")"
KEY_SIZE="$(wc -c < "$TMP_KEY" | tr -d ' ')"
rm -f "$TMP_KEY"

if [ "$WITH_TOKEN_STATUS" = "200" ] && [ "$KEY_SIZE" = "16" ]; then
  echo "PASS token valide -> HTTP 200, 16 octets"
else
  echo "FAIL token valide -> HTTP $WITH_TOKEN_STATUS, $KEY_SIZE octets, attendu 200 et 16 octets"
  FAILURES=$((FAILURES + 1))
fi

NO_TOKEN_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/keys/poc")"
expect_status "sans token" "401" "$NO_TOKEN_STATUS"

BAD_TOKEN_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Authorization: Bearer token-bidon' \
  "$BASE_URL/keys/poc")"
expect_status "token bidon" "401" "$BAD_TOKEN_STATUS"

EXPIRED_TOKEN="$(
  cd "$ROOT_DIR/backend"
  JWT_SECRET="$JWT_SECRET_VALUE" node -e "const jwt = require('jsonwebtoken'); const now = Math.floor(Date.now() / 1000); process.stdout.write(jwt.sign({ sub: 1, username: 'alice', role: 'admin', iat: now - 3600, exp: now - 1800 }, process.env.JWT_SECRET, { noTimestamp: true }));"
)"

EXPIRED_TOKEN_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $EXPIRED_TOKEN" \
  "$BASE_URL/keys/poc")"
expect_status "token expire" "401" "$EXPIRED_TOKEN_STATUS"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
