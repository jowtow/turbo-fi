# TurboFi Development Container

1. Install Docker Desktop for Windows with Linux containers enabled.
2. Install the VS Code **Dev Containers** extension.
3. Open this repository in VS Code and select **Dev Containers: Reopen in Container**.

The devcontainer starts a SQL Server sidecar automatically. API and web should be run from VS Code tasks inside the devcontainer for fast edit/refresh loops.

## Run fully in-container

From VS Code, run these workspace tasks:

1. `api: run`
2. `web: run`

Then browse to:

- Web: `http://localhost:5173`
- API: `http://localhost:8080`

## Database lifecycle

Use these workspace tasks:

- `db: up` starts SQL Server only
- `db: down` stops SQL Server and keeps data
- `db: down (delete volume)` stops SQL Server and deletes data

If this is your first time using GitHub CLI in the container, authenticate once:

```bash
gh auth login
```

Then use Copilot CLI commands like:

```bash
gh copilot suggest "how do I run the api tests?"
```

NuGet packages, frontend `node_modules`, and SQL Server data persist in Docker volumes by default. To remove devcontainer-only volumes, run:

```bash
docker compose -f .devcontainer/docker-compose.yml down -v
```
