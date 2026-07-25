#!/usr/bin/env bash
# One-time TLS bootstrap for fininvest.uz (api + 4 role subdomains).
# Prereqs: DNS A-records point at the edge (87.x), which forwards public 80 -> this
# host's 8080 and 443 -> 9443; deploy/.env filled in; the stack has been started once
# (bash deploy/deploy.sh). ACME http-01 reaches nginx via edge :80 -> :8080 -> nginx :80.
#   bash deploy/init-letsencrypt.sh
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source deploy/.env

domains=(api.fininvest.uz operator.fininvest.uz moderator.fininvest.uz director.fininvest.uz admin.fininvest.uz)
email="${CERTBOT_EMAIL:-khurshidi2827@gmail.com}"
live="/etc/letsencrypt/live/fininvest.uz"

echo "==> 1/4 dummy certificate so nginx can start on 443"
docker compose run --rm --entrypoint "sh -c \
  'mkdir -p $live && openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
   -keyout $live/privkey.pem -out $live/fullchain.pem -subj /CN=localhost'" certbot

echo "==> 2/4 (re)start nginx — serves the ACME challenge on port 80 (via edge :80 -> :8080)"
docker compose --env-file deploy/.env up -d nginx

echo "==> 3/4 replace dummy with a real Let's Encrypt certificate"
docker compose run --rm --entrypoint "sh -c \
  'rm -rf /etc/letsencrypt/live/fininvest.uz /etc/letsencrypt/archive/fininvest.uz /etc/letsencrypt/renewal/fininvest.uz.conf'" certbot

domain_args=""
for d in "${domains[@]}"; do domain_args="$domain_args -d $d"; done

# shellcheck disable=SC2086
docker compose run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  --cert-name fininvest.uz $domain_args \
  --email $email --agree-tos --no-eff-email --force-renewal" certbot

echo "==> 4/4 reload nginx with the real certificate"
docker compose exec nginx nginx -s reload
echo "Done — HTTPS issued for: ${domains[*]}"
