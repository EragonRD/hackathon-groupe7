#!/usr/bin/env bash
# 🎬 Démo P2 en une commande, SANS Docker (backend NestJS + nginx natif).
# Enchaîne : chiffrement HLS -> Core -> nginx (auth_request) -> preuves + attaques.
#
#   Prérequis : ffmpeg, nginx, node (npm).  Usage :  ./scripts/demo-local.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
NGINX_CONF="$WORK_DIR/nginx.conf"
CORE_LOG="$WORK_DIR/core.log"
CORE_PID=""
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
export BASE_URL="http://localhost:3000"

red() { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

cleanup() {
  step "Nettoyage"
  nginx -s stop -c "$NGINX_CONF" 2>/dev/null && echo "nginx stoppé"
  [ -n "$CORE_PID" ] && kill "$CORE_PID" 2>/dev/null && echo "core stoppé"
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

# 0. Prérequis
for bin in ffmpeg nginx node openssl curl; do
  command -v "$bin" >/dev/null 2>&1 || { red "FAIL: '$bin' introuvable"; exit 1; }
done

# 1. Build backend si nécessaire
if [ ! -f "$ROOT_DIR/backend/dist/main.js" ]; then
  step "Build backend"
  (cd "$ROOT_DIR/backend" && npm run build)
fi

# 2. Générer le HLS chiffré si la clé OU la playlist manque (les deux doivent
#    rester cohérents : encrypt-hls.sh régénère clé + segments ensemble).
if [ ! -f "$ROOT_DIR/backend/secrets/poc.key" ] || [ ! -f "$ROOT_DIR/media/hls/poc/index.m3u8" ]; then
  step "Chiffrement HLS"
  bash "$ROOT_DIR/scripts/encrypt-hls.sh"
fi

# 3. Config nginx locale (auth_request -> Core, sert media/hls, refuse /keys)
cat > "$NGINX_CONF" <<EOF
worker_processes 1;
pid $WORK_DIR/nginx.pid;
error_log $WORK_DIR/nginx-error.log;
events { worker_connections 256; }
http {
  access_log $WORK_DIR/nginx-access.log;
  client_body_temp_path $WORK_DIR/tmp;
  proxy_temp_path $WORK_DIR/tmp;
  fastcgi_temp_path $WORK_DIR/tmp;
  uwsgi_temp_path $WORK_DIR/tmp;
  scgi_temp_path $WORK_DIR/tmp;
  default_type application/octet-stream;
  server {
    listen 8080;
    root "$ROOT_DIR/media";
    location /hls/ {
      add_header Access-Control-Allow-Origin "*" always;
      auth_request /_security_auth;
      error_page 401 403 = @scrape_denied;
      try_files \$uri =404;
    }
    location @scrape_denied { return 403 "scraping bloque"; }
    location /keys/ { return 404; }
    location = /_security_auth {
      internal;
      proxy_pass http://127.0.0.1:3000/security/ingest;
      proxy_pass_request_body off;
      proxy_set_header Content-Length "";
      proxy_set_header Authorization \$http_authorization;
      proxy_set_header X-Original-URI \$request_uri;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Real-IP \$remote_addr;
    }
  }
}
EOF
nginx -t -c "$NGINX_CONF" >/dev/null 2>&1 || { red "FAIL: config nginx invalide"; exit 1; }

# 4. Démarrer le Core
step "Démarrage du Core (JWT_SECRET généré)"
(cd "$ROOT_DIR" && JWT_SECRET="$JWT_SECRET" PORT=3000 node backend/dist/main > "$CORE_LOG" 2>&1) &
CORE_PID=$!
for _ in $(seq 1 30); do
  [ "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/" 2>/dev/null)" = "200" ] && break
  sleep 0.5
done
green "Core prêt (PID $CORE_PID)"

# 5. Démarrer nginx
nginx -c "$NGINX_CONF"
green "nginx prêt sur http://localhost:8080"

# 6. Preuves + attaques
step "A · Preuve Zero-Trust"
JWT_SECRET="$JWT_SECRET" bash "$ROOT_DIR/scripts/prove-zero-trust.sh"

step "B · Blocage réel du scraping (via nginx)"
for n in $(seq 1 23); do
  seg=$(( (n - 1) % 20 ))
  printf '%s ' "$(curl -sS -o /dev/null -w '%{http_code}' -H 'X-Forwarded-For: 192.0.2.123' "http://localhost:8080/hls/poc/index${seg}.ts")"
done
echo " <- 1-20 servis (200), puis nginx refuse (403)"

step "B · proxy-ip"; bash "$ROOT_DIR/scripts/attacks/proxy-ip.sh"
step "B · multi-session"; bash "$ROOT_DIR/scripts/attacks/multi-session.sh"
step "B · flood (rate-limit)"; bash "$ROOT_DIR/scripts/attacks/flood.sh"
step "B · scrape-segments (script officiel)"; bash "$ROOT_DIR/scripts/attacks/scrape-segments.sh"

echo ""
green "✅ Démo terminée."
echo "Dashboard : http://localhost:3000/security.html (login alice / password)"
