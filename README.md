# turbo-fi

A personal finance app themed after our cat Turbo.

## Self-hosting (standalone -- easiest)

The standalone image bundles the front-end, API, and SQL Server Express into a single container.
All you need is Docker.

```bash
docker run -d \
  --name turbo-fi \
  -p 80:80 \
  -v turbofi-data:/var/opt/mssql \
  -v turbofi-backups:/backups \
  -e MSSQL_SA_PASSWORD=YourStrongPassword123! \
  -e CorsOrigins=http://your-server-ip-or-domain \
  ghcr.io/jowtow/turbo-fi:latest
```

Then open `http://your-server-ip-or-domain` in a browser.

| Variable | Default | Description |
|---|---|---|
| `MSSQL_SA_PASSWORD` | `TurboFiDev!123` | SQL Server SA password -- **change this** |
| `CorsOrigins` | `http://localhost` | Comma-separated allowed origins for the API |
| `BACKUP_CRON` | `0 2 * * *` | Cron schedule for automatic backups (daily at 2 AM UTC). Set to `disabled` to turn off. |
| `BACKUP_DIR` | `/backups` | Path inside the container where `.bak` files are written |
| `RETAIN_DAYS` | `7` | Number of days to keep backup files before pruning |

### Backups

Backups run automatically on the `BACKUP_CRON` schedule and are written to the `/backups` volume.
Mount it to a host path to keep the files accessible:

```bash
-v /your/host/backup/path:/backups
# or as a named volume:
-v turbofi-backups:/backups
```

To trigger a backup on demand:

```bash
docker exec turbo-fi /app/backup.sh
```

To copy backups out of a named volume to your host:

```bash
docker cp turbo-fi:/backups ./turbofi-backups
```

## Self-hosting (multi-service, for existing Docker Compose home-lab setups)

See `docker-compose.yml` and `.env.example`. This setup runs each service as a separate container
and is designed to sit behind an existing reverse proxy (Traefik, Nginx Proxy Manager, etc.).

```bash
cp .env.example .env   # fill in your values
docker compose up -d
```