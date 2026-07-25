#!/usr/bin/env bash
# One-time server provisioning for FinInvest. Tested on Ubuntu 22.04 LTS (jammy)
# and 24.04; get.docker.com supports both. Installs Docker Engine + Compose plugin,
# opens the firewall. Run as root:
#   sudo bash deploy/server-setup.sh
# The app's nginx is published directly on the host's 80 (HTTP) + 443 (HTTPS) and terminates TLS.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash deploy/server-setup.sh" >&2
  exit 1
fi

echo "==> apt update + base packages"
apt-get update -y
apt-get install -y ca-certificates curl git ufw

echo "==> Install Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version
docker compose version

echo "==> Enable + start Docker"
systemctl enable --now docker

echo "==> Firewall: allow SSH + HTTP/HTTPS"
ufw allow OpenSSH 2>/dev/null || ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status

echo
echo "==> Server ready. Next:"
echo "    cp deploy/.env.example deploy/.env && nano deploy/.env"
echo "    bash deploy/deploy.sh                # build, start, sync schema, seed (app on 80/443)"
echo "    bash deploy/init-letsencrypt.sh      # TLS — after DNS points at this server"
