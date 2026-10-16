#!/usr/bin/env bash
# Deploy / update the production stack on the server. Run from anywhere:
#   ./scripts/deploy.sh            -> latest origin/main
#   ./scripts/deploy.sh <commit>   -> a specific commit (also how to roll back by hand)
# The GitHub Actions deploy workflow runs exactly this over SSH.
#
# Steps: back up the database -> fetch code -> rebuild -> start (migrations run first) ->
# wait until the backend is healthy -> if it never becomes healthy, put the previous
# code back and exit with an error.
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"
BRANCH="${DEPLOY_BRANCH:-main}"

[ -f .env ] || { echo "ERROR: .env is missing - copy .env.production.example to .env and fill it in" >&2; exit 1; }

PREVIOUS="$(git rev-parse HEAD)"
git fetch --quiet origin "$BRANCH"
TARGET="${1:-$(git rev-parse "origin/$BRANCH")}"
echo "==> Deploying $(git rev-parse --short "$TARGET") (currently $(git rev-parse --short "$PREVIOUS"))"

# Safety net before anything changes (skipped on the very first deploy: no database yet)
if [ -n "$($COMPOSE ps -q postgres 2>/dev/null)" ]; then
  echo "==> Backing up the database"
  ./scripts/backup-db.sh || echo "WARNING: backup failed - continuing" >&2
fi

git reset --hard "$TARGET" --quiet

wait_healthy() {
  local cid status
  for _ in $(seq 1 60); do
    cid="$($COMPOSE ps -q backend 2>/dev/null || true)"
    if [ -n "$cid" ]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo none)"
      [ "$status" = "healthy" ] && return 0
    fi
    sleep 3
  done
  return 1
}

echo "==> Building and starting"
$COMPOSE up -d --build --remove-orphans

echo "==> Waiting for the backend to become healthy"
if wait_healthy; then
  docker image prune -f >/dev/null 2>&1 || true
  echo "==> Deployed $(git rev-parse --short HEAD) OK"
  exit 0
fi

echo "ERROR: backend did not become healthy. Recent logs:" >&2
$COMPOSE logs --tail=40 migrate backend >&2 || true
echo "==> Rolling back to $(git rev-parse --short "$PREVIOUS")" >&2
git reset --hard "$PREVIOUS" --quiet
$COMPOSE up -d --build --remove-orphans || true
echo "NOTE: database migrations are additive and are NOT undone by a rollback." >&2
exit 1
