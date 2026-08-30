#!/bin/bash
# Waits for SQL Server to accept connections, then starts the .NET API.
# This handles both first-run (SQL Server initialising its data directory)
# and normal restarts (SQL Server starting up from an existing volume).
echo "[wait-for-mssql] Waiting for SQL Server to be ready..."
until /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
    -Q "SELECT 1" > /dev/null 2>&1; do
    sleep 2
done
echo "[wait-for-mssql] SQL Server is ready. Starting API..."
exec dotnet /app/api/TurboFi.Api.dll
