#!/usr/bin/env bash
#
# fin-invest — one-command dev up.
# Frees the dev ports, ensures deps + shared build + Prisma client/schema are ready,
# optionally seeds, then starts the backend and all four web apps.
#
# Usage:
#   scripts/dev.sh            # init + run everything
#   scripts/dev.sh --seed     # also (re)seed the database first
#   scripts/dev.sh --no-run   # init only, don't start the servers
#
set -euo pipefail

# Repo root (this script lives in scripts/).
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SEED=0
RUN=1
for arg in "$@"; do
  case "$arg" in
    --seed)   SEED=1 ;;
    --no-run) RUN=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

say() { printf '\033[36m▶ %s\033[0m\n' "$1"; }

# --- Free the dev ports (Windows/Git-Bash aware) ---------------------------------
free_port() {
  local port="$1"
  # netstat lists PIDs in the last column for LISTENING sockets.
  local pids
  pids=$(netstat -ano 2>/dev/null | grep -E ":${port}\b" | grep -i LISTENING | awk '{print $NF}' | sort -u || true)
  for pid in $pids; do
    [ -n "$pid" ] && [ "$pid" != "0" ] || continue
    say "freeing port ${port} (PID ${pid})"
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
  done
}
say "freeing dev ports (3000, 5173-5176)"
for p in 3000 5173 5174 5175 5176; do free_port "$p"; done

# --- Deps ------------------------------------------------------------------------
if [ ! -d node_modules ]; then
  say "installing dependencies (first run)…"
  npm install
fi

# --- Shared package (backend + prisma consume its dist) --------------------------
say "building @credit-core/shared…"
npm run build -w @credit-core/shared

# --- Prisma: client + schema sync ------------------------------------------------
say "prisma generate…"
npm run db:generate -w @credit-core/backend
say "prisma db push (sync schema)…"
npm run db:push -w @credit-core/backend -- --accept-data-loss --skip-generate

# --- Optional seed ---------------------------------------------------------------
if [ "$SEED" -eq 1 ]; then
  say "seeding database…"
  npm run db:seed -w @credit-core/backend
fi

if [ "$RUN" -eq 0 ]; then
  say "init done (--no-run). Start later with: npm run dev"
  exit 0
fi

# --- Run everything --------------------------------------------------------------
cat <<'EOF'

  fin-invest is starting:
    backend   → http://localhost:3000/api
    operator  → http://localhost:5173
    moderator → http://localhost:5174
    director  → http://localhost:5175
    admin     → http://localhost:5176
  login: operator|moderator|director|admin  /  parol123

EOF
say "starting backend + 4 web apps (concurrently)…"
exec npm run dev
