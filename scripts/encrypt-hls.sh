#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_FILE="$ROOT_DIR/media/42 - POC Parc des Princes V1 .mp4"
OUTPUT_DIR="$ROOT_DIR/media/hls/poc"
SECRETS_DIR="$ROOT_DIR/backend/secrets"
KEY_FILE="$SECRETS_DIR/poc.key"
KEY_INFO_FILE="$SECRETS_DIR/poc.keyinfo"
KEY_URI="http://localhost:3000/keys/poc"
KEY_PATH_FOR_FFMPEG="backend/secrets/poc.key"

if ! command -v openssl >/dev/null 2>&1; then
  echo "FAIL openssl introuvable"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "FAIL ffmpeg introuvable"
  exit 1
fi

if [ ! -f "$SOURCE_FILE" ]; then
  echo "FAIL video source introuvable: $SOURCE_FILE"
  exit 1
fi

mkdir -p "$SECRETS_DIR" "$OUTPUT_DIR"
openssl rand 16 > "$KEY_FILE"
IV_HEX="$(openssl rand -hex 16)"

printf '%s\n%s\n%s\n' "$KEY_URI" "$KEY_PATH_FOR_FFMPEG" "$IV_HEX" > "$KEY_INFO_FILE"

rm -f "$OUTPUT_DIR"/*.ts "$OUTPUT_DIR"/index.m3u8

(
  cd "$ROOT_DIR"
  ffmpeg -hide_banner -loglevel warning -y \
    -i "$SOURCE_FILE" \
    -c copy \
    -hls_key_info_file "$KEY_INFO_FILE" \
    -hls_time 4 \
    -hls_playlist_type vod \
    "$OUTPUT_DIR/index.m3u8"
)

if ! grep -q '#EXT-X-KEY:METHOD=AES-128,URI="http://localhost:3000/keys/poc"' "$OUTPUT_DIR/index.m3u8"; then
  echo "FAIL playlist generee sans URI de cle attendue"
  exit 1
fi

echo "PASS HLS chiffre genere dans $OUTPUT_DIR"
echo "Cle AES: $KEY_FILE"
