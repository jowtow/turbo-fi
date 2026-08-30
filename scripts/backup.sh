#!/usr/bin/env bash
# backup.sh — Back up the TurboFi SQL Server database to a .bak file on the host.
#
# Usage:
#   MSSQL_SA_PASSWORD=<password> ./scripts/backup.sh
#
# Optional environment variables:
#   BACKUP_DIR      Directory on the host to store .bak files (default: ./backups)
#   RETAIN_DAYS     Number of days to keep backups (default: 7)
#   COMPOSE_PROJECT Name of the Docker Compose project (default: turbo-fi)
#
# Schedule with cron, e.g. daily at 2 AM:
#   0 2 * * * cd /path/to/turbo-fi && MSSQL_SA_PASSWORD=secret ./scripts/backup.sh >> /var/log/turbofi-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-turbo-fi}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BAK_FILENAME="TurboFi_${TIMESTAMP}.bak"
CONTAINER_BAK_PATH="/var/opt/mssql/backup/${BAK_FILENAME}"

if [[ -z "${MSSQL_SA_PASSWORD:-}" ]]; then
  echo "ERROR: MSSQL_SA_PASSWORD is not set." >&2
  exit 1
fi

# Resolve the running database container from the compose project
CONTAINER_ID="$(docker ps --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
  --filter "label=com.docker.compose.service=database" --format "{{.ID}}" | head -n1)"

if [[ -z "$CONTAINER_ID" ]]; then
  echo "ERROR: Could not find a running 'database' container for compose project '${COMPOSE_PROJECT}'." >&2
  exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup → ${BAK_FILENAME}"

# Ensure the backup directory exists inside the container
docker exec "$CONTAINER_ID" mkdir -p /var/opt/mssql/backup

# Run the SQL Server backup
docker exec "$CONTAINER_ID" \
  /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" \
  -Q "BACKUP DATABASE [TurboFi] TO DISK = '${CONTAINER_BAK_PATH}' WITH FORMAT, INIT, NAME = 'TurboFi-${TIMESTAMP}'"

# Copy the .bak file out of the container to the host
mkdir -p "$BACKUP_DIR"
docker cp "${CONTAINER_ID}:${CONTAINER_BAK_PATH}" "${BACKUP_DIR}/${BAK_FILENAME}"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Saved to ${BACKUP_DIR}/${BAK_FILENAME}"

# Remove the .bak from inside the container to keep the volume tidy
docker exec "$CONTAINER_ID" rm -f "$CONTAINER_BAK_PATH"

# Prune old backups on the host
find "$BACKUP_DIR" -name "TurboFi_*.bak" -mtime "+${RETAIN_DAYS}" -print -delete \
  | sed 's/^/[pruned] /'

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete."
