# Docker Guide — azure-msal-nextjs-springboot-demo

Complete instructions for building, pushing to DockerHub, and running locally.

---

## ⚠️ Critical: NEXT_PUBLIC_ Variables and Docker

**This is the most important thing to understand before working with Docker here.**

Next.js compiles `NEXT_PUBLIC_` variables into the JavaScript bundle at **build time** using webpack. They become hard-coded string literals in the `.js` files — they are NOT read from the environment when the container starts.

| Variable type | When is it read? | How to set for Docker |
|---|---|---|
| `NEXT_PUBLIC_*` | **Build time** (`npm run build`) | Docker `--build-arg` |
| Server-only (e.g. `AZURE_CLIENT_SECRET`) | **Runtime** (when Node.js starts) | `docker run -e` or `environment:` in compose |

**Consequence:** The frontend Docker image is environment-specific. Each environment (dev vs prod) needs its own build because the Azure AD URLs and client IDs are baked in. The backend image is universal — one image works for all environments.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [DockerHub account](https://hub.docker.com) (free) — for pushing/sharing images
- Azure AD configured (see `AZURE_SETUP.md`)
- Git (to clone the repo)

---

## Option A — Run from Source (Recommended for Developers)

Anyone with the source code can run the full project locally with one command.

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/azure-msal-nextjs-springboot-demo.git
cd azure-msal-nextjs-springboot-demo
```

### Step 2 — Create the dev environment file

```bash
cp .env.dev.example .env.dev
```

Open `.env.dev` and fill in your Azure AD values:

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-frontend-app-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_APP_SCOPE=api://your-backend-client-id/.default
AZURE_BACKEND_CLIENT_ID=your-backend-client-id

NEXT_PUBLIC_AZURE_TENANT_ID=your-tenant-id
NEXT_PUBLIC_AZURE_CLIENT_ID=your-frontend-app-client-id
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_BACKEND_SCOPE=api://your-backend-client-id/data.read
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080

BACKEND_INTERNAL_URL=http://backend:8080
FRONTEND_URL=http://localhost:3000

DOCKERHUB_USERNAME=your-dockerhub-username
IMAGE_TAG=latest
```

### Step 3 — Build and run

```bash
docker compose --env-file .env.dev up --build
```

Docker will:
1. Build the Spring Boot JAR (Maven inside Docker — no local Java needed)
2. Build the Next.js bundle with your NEXT_PUBLIC_ values baked in
3. Start both containers on a shared Docker network

### Step 4 — Open the app

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api/public/data

### Useful commands

```bash
# Run in background (detached)
docker compose --env-file .env.dev up --build -d

# View logs
docker compose logs -f

# View logs for one service
docker compose logs -f frontend
docker compose logs -f backend

# Rebuild after code changes
docker compose --env-file .env.dev up --build --force-recreate

# Stop containers (keeps volumes)
docker compose down

# Stop and remove everything including volumes
docker compose down -v
```

---

## Option B — Push Your Images to DockerHub

Useful when you want to share your running configuration with teammates who have
the same Azure AD tenant and don't want to clone the source.

### Step 1 — Log in to DockerHub

```bash
docker login
# Enter your DockerHub username and password
```

### Step 2 — Build the backend image (universal — no Azure values baked in)

```bash
docker build \
  -t YOUR_DOCKERHUB_USERNAME/msal-demo-backend:latest \
  ./backend
```

### Step 3 — Build the frontend image (Azure values baked in — environment-specific)

```bash
# Fill in your actual Azure AD values for the environment you're building for
docker build \
  --build-arg NEXT_PUBLIC_AZURE_TENANT_ID=your-tenant-id \
  --build-arg NEXT_PUBLIC_AZURE_CLIENT_ID=your-frontend-client-id \
  --build-arg NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_BACKEND_SCOPE=api://your-backend-client-id/data.read \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080 \
  -t YOUR_DOCKERHUB_USERNAME/msal-demo-frontend:latest \
  ./frontend
```

### Step 4 — Push both images to DockerHub

```bash
docker push YOUR_DOCKERHUB_USERNAME/msal-demo-backend:latest
docker push YOUR_DOCKERHUB_USERNAME/msal-demo-frontend:latest
```

Your images are now public on https://hub.docker.com/u/YOUR_DOCKERHUB_USERNAME

### Step 5 — Verify on DockerHub

Go to https://hub.docker.com and confirm both repositories appear:
- `YOUR_DOCKERHUB_USERNAME/msal-demo-backend`
- `YOUR_DOCKERHUB_USERNAME/msal-demo-frontend`

---

## Option C — Pull and Run Images from DockerHub (No Source Code Needed)

For developers who want to run the project without cloning the source.
They need Docker Desktop and a `.env.prod` file with the Azure AD values.

### Step 1 — Get the environment file

The image publisher should share the `.env.prod.example` file (from the repo or directly).
Do NOT share `.env.prod` — it contains secrets.

```bash
# Create your env file (get .env.prod.example from the repo or image publisher)
cp .env.prod.example .env.prod
# Edit .env.prod with your values
```

### Step 2 — Get the docker-compose.prod.yml file

```bash
# Download just the compose file (no need to clone the whole repo)
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/azure-msal-nextjs-springboot-demo/main/docker-compose.prod.yml
```

Or copy its contents manually into a local `docker-compose.prod.yml`.

### Step 3 — Pull and run

```bash
# Pull images from DockerHub and start
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Docker automatically pulls:
- `YOUR_USERNAME/msal-demo-backend:latest`
- `YOUR_USERNAME/msal-demo-frontend:latest`

### Step 4 — Open the app

- Frontend: http://localhost:3000
- Backend: http://localhost:8080

### Step 5 — Stop

```bash
docker compose -f docker-compose.prod.yml down
```

---

## Building for Production (Versioned Tags)

Use version tags instead of `latest` for production releases:

```bash
# Build with version tag
docker build -t YOUR_USERNAME/msal-demo-backend:1.0.0 ./backend
docker build \
  --build-arg NEXT_PUBLIC_REDIRECT_URI=https://your-app.vercel.app \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL=https://your-backend.onrender.com \
  # ... other args ...
  -t YOUR_USERNAME/msal-demo-frontend:1.0.0 \
  ./frontend

# Push version tag AND update latest
docker push YOUR_USERNAME/msal-demo-backend:1.0.0
docker push YOUR_USERNAME/msal-demo-backend:latest
docker push YOUR_USERNAME/msal-demo-frontend:1.0.0
docker push YOUR_USERNAME/msal-demo-frontend:latest
```

Update `IMAGE_TAG=1.0.0` in `.env.prod` to pin to a specific version.

---

## Environment Variable Reference (Docker Context)

### Variables by scope

```
┌─────────────────────────────────────────────────────────────────┐
│  DOCKER BUILD TIME                                              │
│  (--build-arg, baked into image, cannot change after build)    │
│                                                                 │
│  NEXT_PUBLIC_AZURE_TENANT_ID                                    │
│  NEXT_PUBLIC_AZURE_CLIENT_ID                                    │
│  NEXT_PUBLIC_REDIRECT_URI                                       │
│  NEXT_PUBLIC_BACKEND_SCOPE                                      │
│  NEXT_PUBLIC_BACKEND_API_URL    ← browser-facing backend URL   │
└─────────────────────────────────────────────────────────────────┘
                        ▼ image built ▼
┌─────────────────────────────────────────────────────────────────┐
│  DOCKER RUNTIME (docker run -e / environment: in compose)      │
│  (injected when container starts, can differ per environment)  │
│                                                                 │
│  FRONTEND:                                                      │
│    AZURE_TENANT_ID          AZURE_CLIENT_ID                    │
│    AZURE_CLIENT_SECRET      AZURE_APP_SCOPE                    │
│    BACKEND_INTERNAL_URL  ← Docker network URL (not browser)    │
│                                                                 │
│  BACKEND:                                                       │
│    AZURE_TENANT_ID          AZURE_BACKEND_CLIENT_ID            │
│    FRONTEND_URL             (CORS allowed origin)              │
└─────────────────────────────────────────────────────────────────┘
```

### Why two backend URL variables?

| Variable | Value (dev) | Used by | Visible to browser? |
|---|---|---|---|
| `NEXT_PUBLIC_BACKEND_API_URL` | `http://localhost:8080` | Browser JS (Dashboard.tsx) | Yes — baked into bundle |
| `BACKEND_INTERNAL_URL` | `http://backend:8080` | Next.js server (route.ts) | No — runtime only |

The browser cannot reach `http://backend:8080` (Docker internal hostname).
The Next.js server can — it runs inside the same Docker network.

---

## DockerHub Free Tier Limits

| Limit | Free tier |
|---|---|
| Public repositories | Unlimited |
| Private repositories | 1 |
| Pull rate limit | 100 pulls/6h (unauthenticated), 200/6h (authenticated) |
| Image storage | Unlimited for public repos |
| Image size limit | None specified |

For a demo project with public images, the free tier is more than sufficient.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `NEXT_PUBLIC_` var is wrong after changing .env.dev | Baked at build time, not runtime | `docker compose --env-file .env.dev up --build --force-recreate` |
| Backend OOM crash | 512 MB RAM limit hit | `JAVA_TOOL_OPTIONS=-Xmx256m -XX:+UseSerialGC` (already set in Dockerfile) |
| `502 Bad Gateway` on frontend | Backend not ready yet | Wait 30s for Spring Boot startup; check `docker compose logs backend` |
| `AADSTS50011` after deploying | Redirect URI not registered in Azure | Add production URL to Azure portal → App reg → Authentication |
| Frontend can't reach backend | Wrong `BACKEND_INTERNAL_URL` | Must match service name in docker-compose: `http://backend:8080` |
| `manifest unknown` on pull | Image not pushed / wrong username | Check DockerHub dashboard; verify `DOCKERHUB_USERNAME` in .env |
