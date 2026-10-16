#!/usr/bin/env bash
# Dump the production database to backups/smart-YYYYmmdd-HHMMSS.sql.gz, keep the newest 14.
# Run by deploy.sh before each deploy; also schedule it daily (see DEPLOYMENT.md).
# Restore:  gunzip -c backups/<file>.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U smart_user smart_airway
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
OUT="backups/smart-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U smart_user --no-owner smart_airway | gzip > "$OUT"
[ -s "$OUT" ] || { rm -f "$OUT"; echo "backup is empty - failed" >&2; exit 1; }
ls -1t backups/smart-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "backup written: $OUT ($(du -h "$OUT" | cut -f1))"
