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

exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/turbofi.conf
