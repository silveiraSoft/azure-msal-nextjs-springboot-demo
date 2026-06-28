# Deployment Guide

This guide covers every way to run this project:

- [Local dev (no Docker)](#1-local-dev-no-docker)
- [Local dev with Docker](#2-local-dev-with-docker)
- [Build & push images to DockerHub](#3-build--push-images-to-dockerhub)
- [Run from DockerHub locally](#4-run-from-dockerhub-locally)
- [Deploy to Vercel (frontend)](#5-deploy-to-vercel-frontend)
- [Deploy to Render (backend)](#6-deploy-to-render-backend)
- [Set up Neon PostgreSQL](#7-set-up-neon-postgresql)

---

## 1. Local dev (no Docker)

The quickest way to run everything on your machine without Docker. Uses H2 in-memory database — no Postgres setup needed.

**Backend**

Windows (PowerShell):
```powershell
cd backend
$env:AZURE_TENANT_ID="your-tenant-id"
$env:AZURE_BACKEND_CLIENT_ID="your-backend-client-id"
$env:FRONTEND_URL="http://localhost:3000"
mvn spring-boot:run
```

Linux / macOS (bash):
```bash
cd backend
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_BACKEND_CLIENT_ID="your-backend-client-id"
export FRONTEND_URL="http://localhost:3000"
mvn spring-boot:run
```
→ http://localhost:8080

**Frontend**

```bash
cd frontend
cp .env.local.example .env.local   # edit with your Azure AD values
npm install
npm run dev
# → http://localhost:3000
```

`.env.local` minimum content:
```
NEXT_PUBLIC_AZURE_TENANT_ID=...
NEXT_PUBLIC_AZURE_CLIENT_ID=...
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_BACKEND_SCOPE=api://.../.default
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_APP_SCOPE=api://.../.default
```

---

## 2. Local dev with Docker

Builds from source, runs a real PostgreSQL container alongside the app.

```bash
# First time setup
cp .env.dev.example .env.dev
# Edit .env.dev — fill in all Azure AD values

# Start everything (builds images + starts DB)
docker compose --env-file .env.dev up --build

# Stop (keeps DB data in postgres_data volume)
docker compose down

# Stop and wipe all data
docker compose down -v
```

Services that start:
- `db` → PostgreSQL 16 on port 5432
- `backend` → Spring Boot on port 8080 (waits for DB healthy)
- `frontend` → Next.js on port 3000 (waits for backend healthy)

Visit http://localhost:3000

---

## 3. Build & push images to DockerHub

### Prerequisites
- Docker Desktop running
- DockerHub account (free at hub.docker.com)
- Logged in: `docker login`

### Build backend image

The backend image contains NO secrets — all config is injected at runtime. It is safe to push publicly.

```bash
cd backend

docker build -t your-username/msal-demo-backend:latest .
docker push your-username/msal-demo-backend:latest

# Tag a versioned release too
docker tag your-username/msal-demo-backend:latest your-username/msal-demo-backend:1.0.0
docker push your-username/msal-demo-backend:1.0.0
```

### Build frontend image

⚠️ **The frontend image bakes your Azure AD values into the JS bundle at build time.** Each developer/team must build their own frontend image with their own tenant values.

```bash
cd frontend

docker build \
  --build-arg NEXT_PUBLIC_AZURE_TENANT_ID="your-tenant-id" \
  --build-arg NEXT_PUBLIC_AZURE_CLIENT_ID="your-frontend-client-id" \
  --build-arg NEXT_PUBLIC_REDIRECT_URI="http://localhost:3000" \
  --build-arg NEXT_PUBLIC_BACKEND_SCOPE="api://your-backend-id/data.read" \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL="http://localhost:8080" \
  -t your-username/msal-demo-frontend:latest .

docker push your-username/msal-demo-frontend:latest
```

For production (pointing to Vercel + Render):
```bash
docker build \
  --build-arg NEXT_PUBLIC_AZURE_TENANT_ID="your-tenant-id" \
  --build-arg NEXT_PUBLIC_AZURE_CLIENT_ID="your-frontend-client-id" \
  --build-arg NEXT_PUBLIC_REDIRECT_URI="https://your-app.vercel.app" \
  --build-arg NEXT_PUBLIC_BACKEND_SCOPE="api://your-backend-id/data.read" \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL="https://your-backend.onrender.com" \
  -t your-username/msal-demo-frontend:prod .

docker push your-username/msal-demo-frontend:prod
```

---

## 4. Run from DockerHub locally

Use this to run the project without cloning the repo or building images.

```bash
# Copy the production compose file (or download it from the repo)
# Edit .env.prod with your values
cp .env.prod.example .env.prod

# Pull and run
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop
docker compose -f docker-compose.prod.yml down
```

**Note on the frontend image:** If you are using someone else's DockerHub frontend image, the Azure AD tenant and URLs are theirs (baked in at build time). You must build your own frontend image to use your own Azure AD tenant. See section 3 above.

---

## 5. Deploy to Vercel (frontend)

Vercel is the recommended platform for Next.js. Free tier supports personal projects.

### First deploy

1. Push your code to GitHub.
2. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo.
3. Vercel detects `vercel.json` automatically.
4. Under **Environment Variables**, add all required vars (see below).
5. Click **Deploy**.

### Required environment variables in Vercel dashboard

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Azure portal → your tenant ID |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Frontend app registration → Application ID |
| `NEXT_PUBLIC_REDIRECT_URI` | `https://your-app.vercel.app` (your Vercel URL) |
| `NEXT_PUBLIC_BACKEND_SCOPE` | `api://backend-client-id/data.read` |
| `NEXT_PUBLIC_BACKEND_API_URL` | Your Render backend URL |
| `AZURE_TENANT_ID` | Same as above |
| `AZURE_CLIENT_ID` | Frontend app registration → Application ID |
| `AZURE_CLIENT_SECRET` | Frontend app registration → Certificates & Secrets |
| `AZURE_APP_SCOPE` | `api://backend-client-id/.default` |
| `BACKEND_INTERNAL_URL` | Same as `NEXT_PUBLIC_BACKEND_API_URL` (Vercel calls it directly, no Docker network) |

### Update Azure Redirect URIs

After getting your Vercel URL, add it to Azure portal:
1. Azure portal → App registrations → your frontend app
2. Authentication → Redirect URIs → Add `https://your-app.vercel.app`

### Redeploy on code changes

Push to your main branch — Vercel auto-deploys on every push.

---

## 6. Deploy to Render (backend)

Render is the recommended platform for the Spring Boot backend. Free Web Service tier available.

### Deploy with render.yaml (recommended)

`render.yaml` in the repo root is a Render Blueprint that automates the setup.

1. Push your code to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) → New → Blueprint.
3. Connect your GitHub repo.
4. Render finds `render.yaml` automatically.
5. Fill in the environment variables marked `sync: false`:
   - `AZURE_TENANT_ID`
   - `AZURE_BACKEND_CLIENT_ID`
   - `FRONTEND_URL` (your Vercel URL)
   - `SPRING_DATASOURCE_URL` (your Neon JDBC URL)
   - `SPRING_DATASOURCE_USERNAME`
   - `SPRING_DATASOURCE_PASSWORD`
6. Click **Apply** — Render builds and deploys.

### Deploy manually (without Blueprint)

1. New → Web Service → Connect repo.
2. **Environment**: Docker.
3. **Dockerfile Path**: `./backend/Dockerfile`.
4. **Docker Context**: `./backend`.
5. **Plan**: Free.
6. Add env vars from step 5 above.
7. Click **Create Web Service**.

### Free tier limitations

- Service **sleeps after 15 minutes** of no traffic.
- First request after sleep takes ~30 seconds (cold start).
- 750 free hours/month is enough for one always-on service.
- To avoid cold starts: upgrade to Starter ($7/month) or use an uptime pinger.

### Health check

Render monitors `/actuator/health`. Spring Boot Actuator exposes this endpoint automatically.

---

## 7. Set up Neon PostgreSQL

Neon is a serverless PostgreSQL provider with a generous free tier (5 GB storage, no pauses on free plan since 2024).

### Create a Neon project

1. Sign up at [neon.tech](https://neon.tech) (free, no credit card).
2. New Project → give it a name (e.g. `msal-demo`).
3. Select a region close to your Render backend.
4. Click **Create Project**.

### Get the connection string

1. Dashboard → your project → **Connection Details**.
2. Select **JDBC** from the dropdown.
3. Copy the connection string. It looks like:
   ```
   jdbc:postgresql://ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Note the **User** and **Password** from the same page.

### Add to Render (or .env.prod)

```
SPRING_DATASOURCE_URL=jdbc:postgresql://ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
SPRING_DATASOURCE_USERNAME=your-neon-user
SPRING_DATASOURCE_PASSWORD=your-neon-password
```

### What happens on first deploy

Spring Boot runs `data.sql` on startup (because `SQL_INIT_MODE=always`). The seed inserts use `WHERE NOT EXISTS`, so rows are only added once.

Hibernate creates the `data_items` table automatically (`JPA_DDL_AUTO=update`).

After confirming everything works, you can set `JPA_DDL_AUTO=validate` in production to prevent accidental schema changes.

---

## Environment variable quick reference

| Variable | Used by | When |
|---|---|---|
| `AZURE_TENANT_ID` | Backend (JWT issuer), Frontend (MSAL Node) | Runtime |
| `AZURE_BACKEND_CLIENT_ID` | Backend (audience validation) | Runtime |
| `AZURE_CLIENT_ID` | Frontend (MSAL Node confidential client) | Runtime |
| `AZURE_CLIENT_SECRET` | Frontend (MSAL Node confidential client) | Runtime |
| `AZURE_APP_SCOPE` | Frontend (client credentials token request) | Runtime |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Frontend (MSAL Browser) | **Build time** |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Frontend (MSAL Browser) | **Build time** |
| `NEXT_PUBLIC_REDIRECT_URI` | Frontend (MSAL Browser) | **Build time** |
| `NEXT_PUBLIC_BACKEND_SCOPE` | Frontend (MSAL Browser token request) | **Build time** |
| `NEXT_PUBLIC_BACKEND_API_URL` | Frontend (browser fetch calls) | **Build time** |
| `BACKEND_INTERNAL_URL` | Frontend (server-side fetch in route handlers) | Runtime |
| `FRONTEND_URL` | Backend (CORS allowed origin) | Runtime |
| `SPRING_DATASOURCE_URL` | Backend (JPA datasource) | Runtime |
| `SPRING_DATASOURCE_USERNAME` | Backend (JPA datasource) | Runtime |
| `SPRING_DATASOURCE_PASSWORD` | Backend (JPA datasource) | Runtime |

> **Build time** = must be passed as `--build-arg` to `docker build`, or set as Vercel Environment Variable before deploy. Cannot be changed without rebuilding.
