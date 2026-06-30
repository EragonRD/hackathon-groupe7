#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${TARGET_URL:-http://localhost:3000/}"
REQUESTS="${REQUESTS:-130}"
ATTACK_IP="${ATTACK_IP:-192.0.2.250}"
SAW_429=0

for i in $(seq 1 "$REQUESTS"); do
  STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "X-Forwarded-For: $ATTACK_IP" \
    "$TARGET_URL")"

  if [ "$STATUS" = "429" ]; then
    SAW_429=1
    echo "PASS rate-limit atteint a la requete $i -> HTTP 429"
    break
  fi
done

if [ "$SAW_429" -ne 1 ]; then
  echo "FAIL aucun HTTP 429 apres $REQUESTS requetes"
  exit 1
fi
