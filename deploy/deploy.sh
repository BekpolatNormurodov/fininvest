#!/usr/bin/env bash
# First-time production install on the server. Run from the repo root.
#   bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f deploy/.env ]; then
  echo "ERROR: deploy/.env missing. Copy deploy/.env.example to deploy/.env and fill it in." >&2
  exit 1
fi

# nginx's :443 listener needs a cert to start. On a fresh install none exists yet, so drop a
# self-signed fallback (init-letsencrypt.sh later swaps in a real Let's Encrypt cert). This
# lets nginx serve HTTPS from the first boot instead of crash-looping on a missing cert.
live="/etc/letsencrypt/live/fininvest.uz"
if [ ! -f deploy/nginx/certs/live/fininvest.uz/fullchain.pem ]; then
  echo "==> No TLS cert found — generating a self-signed fallback so nginx can start on :443"
  docker compose --env-file deploy/.env run --rm --no-deps --entrypoint \
    "sh -c 'mkdir -p $live && openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout $live/privkey.pem -out $live/fullchain.pem -subj /CN=fininvest.uz'" \
    certbot
fi

bash deploy/build-images.sh

echo "==> Starting containers"
docker compose --env-file deploy/.env up -d
# The backend container syncs the DB schema (prisma db push) on start.

echo "==> Waiting for the backend to come up"
sleep 15

echo "==> Seeding initial data (first run only; safe to skip if already seeded)"
docker compose exec -T backend npm run db:seed || echo "seed skipped (ok if already seeded)"

echo
echo "==> App is up on 8080 (HTTP) + 9443 (HTTPS). Next: issue TLS certificates with:"
echo "    bash deploy/init-letsencrypt.sh   # needs the edge forwarding public :80 -> this host :8080"
docker compose ps
