#!/bin/bash
# Container entrypoint for the standalone TurboFi image.
# Sets default values for all required environment variables and hands off to supervisord.
set -e

export ACCEPT_EULA=Y
export MSSQL_PID="${MSSQL_PID:-Express}"
export MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-TurboFiDev!123}"

# Build the connection string from the SA password so users only need to set one variable
export ConnectionStrings__TurboFi="${ConnectionStrings__TurboFi:-Server=localhost,1433;Database=TurboFi;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=True}"

# CorsOrigins defaults to localhost — override with your public domain in production
export CorsOrigins="${CorsOrigins:-http://localhost}"

export ASPNETCORE_URLS="http://+:8080"

export BACKUP_DIR="${BACKUP_DIR:-/backups}"
export RETAIN_DAYS="${RETAIN_DAYS:-7}"

# Write vars needed by the backup script to /etc/environment so cron jobs inherit them
# (cron does not inherit the shell environment)
{
    echo "MSSQL_SA_PASSWORD=${MSSQL_SA_PASSWORD}"
    echo "BACKUP_DIR=${BACKUP_DIR}"
    echo "RETAIN_DAYS=${RETAIN_DAYS}"
    echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/mssql-tools18/bin"
} >> /etc/environment

# Install the backup cron job unless explicitly disabled
BACKUP_CRON="${BACKUP_CRON:-0 2 * * *}"
if [ "$BACKUP_CRON" != "disabled" ]; then
    echo "$BACKUP_CRON root /app/backup.sh >> /var/log/turbofi-backup.log 2>&1" \
        > /etc/cron.d/turbofi-backup
    chmod 0644 /etc/cron.d/turbofi-backup
    echo "[entrypoint] Backup schedule: ${BACKUP_CRON}"
else
    rm -f /etc/cron.d/turbofi-backup
    echo "[entrypoint] Automatic backups disabled."
fi

exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/turbofi.conf
