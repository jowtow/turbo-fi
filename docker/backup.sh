#!/bin/bash
# Backup script bundled inside the standalone container.
# Runs against the local SQL Server instance — no Docker CLI needed.
#
# Usage (on-demand):
#   docker exec turbo-fi /app/backup.sh
#
# Automatic backups are scheduled via the BACKUP_CRON env var (default: daily at 2 AM UTC).
# Set BACKUP_CRON=disabled to turn off the schedule entirely.

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BAK_FILENAME="TurboFi_${TIMESTAMP}.bak"

if [[ -z "${MSSQL_SA_PASSWORD:-}" ]]; then
    echo "ERROR: MSSQL_SA_PASSWORD is not set." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup → ${BAK_FILENAME}"
/opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
    -Q "BACKUP DATABASE [TurboFi] TO DISK = '${BACKUP_DIR}/${BAK_FILENAME}' WITH FORMAT, INIT, NAME = 'TurboFi-${TIMESTAMP}'"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup written to ${BACKUP_DIR}/${BAK_FILENAME}"

# Prune old backups
find "$BACKUP_DIR" -name "TurboFi_*.bak" -mtime "+${RETAIN_DAYS}" -print -delete \
    | sed 's/^/[pruned] /'

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Done."
