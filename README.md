# Azure MSAL + Next.js 14 + Spring Boot 3 Demo

A full-stack authentication demo using **Microsoft Azure AD (Entra ID)** — two simultaneous token flows, two user roles, and a complete free-tier deployment stack ready to show recruiters.

```
Browser ──[user login popup]──► Azure AD ──[user JWT]──► Spring Boot
                                               │
Next.js server ──[client credentials]──► Azure AD ──[app JWT]──► Spring Boot
```

**Live demo:** [https://your-app.vercel.app](https://your-app.vercel.app) ← replace with your Vercel URL after deploying

---

## What This Demonstrates

- **Application token flow** — Next.js server fetches data without any user logged in (client credentials / machine-to-machine)
- **User token flow** — browser login via MSAL popup, protected dashboard with a real Azure AD user JWT
- **Two roles** — `Admin` (admin panel visible) and `User` (dashboard only), enforced by Spring Boot
- **PostgreSQL** — H2 for local dev, Postgres for Docker, Neon serverless for production
- **Mobile-responsive** — works on phones, tablets, and desktop

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind CSS) — responsive, mobile-ready |
| Backend | Spring Boot 3.2 (Java 17, OAuth2 Resource Server) |
| Auth | Azure Entra ID Free (OAuth 2.0 / OIDC) |
| Database | H2 (local) / PostgreSQL (Docker) / Neon (production) |
| Deploy | Vercel (frontend) + Render (backend) + Neon (DB) — all free |

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure AD Setup — do this first (15 min)](#1-azure-ad-setup--do-this-first-15-min)
3. [Run Locally — Clone from GitHub](#2-run-locally--clone-from-github)
4. [Run with Docker (recommended)](#3-run-with-docker-recommended)
5. [Run from DockerHub — no code clone needed](#4-run-from-dockerhub--no-code-clone-needed)
6. [Deploy to Production — Free](#5-deploy-to-production--free)
7. [View the Live Demo](#6-view-the-live-demo)
8. [Run Tests](#7-run-tests)
9. [Project Structure](#8-project-structure)
10. [Environment Variables Reference](#9-environment-variables-reference)
11. [Mobile / Responsive](#10-mobile--responsive)
12. [Documentation](#11-documentation)

---

## Prerequisites

**Azure account (free):** [portal.azure.com](https://portal.azure.com) — no credit card needed for Entra ID.

**For local dev without Docker:**
- Java 17+ (`java -version`)
- Maven 3.9+ (`mvn -version`)
- Node.js 20+ (`node -version`)

**For Docker:**
- Docker Desktop (Windows / macOS) or Docker Engine (Linux)

**For deploying:**
- [GitHub](https://github.com) account — to host the repo
- [Vercel](https://vercel.com) account — free, connects to GitHub
- [Render](https://render.com) account — free, connects to GitHub
- [Neon](https://neon.tech) account — free serverless PostgreSQL

---

## 1. Azure AD Setup — do this first (15 min)

> Full step-by-step guide with exact field values: [`AZURE_SETUP.md`](./AZURE_SETUP.md)

You need two app registrations and two test users. Here is the summary:

### What to create

| Item | Where in Azure portal | Purpose |
|---|---|---|
| `msal-demo-backend` app registration | Entra ID → App registrations → New | Defines `data.read` scope + `Admin`/`User` app roles |
| `msal-demo-frontend` app registration | Entra ID → App registrations → New | SPA platform + client secret, grants `data.read` |
| Admin test user | Entra ID → Users → New user | Assigned `Admin` role |
| Regular test user | Entra ID → Users → New user | Assigned `User` role |

### Values you will collect

After Azure setup, save these — you'll need them in every environment:

```
AZURE_TENANT_ID          = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_BACKEND_CLIENT_ID  = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   ← backend app
AZURE_CLIENT_ID          = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   ← frontend app
AZURE_CLIENT_SECRET      = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Two values you compute from those:
```
NEXT_PUBLIC_BACKEND_SCOPE = api://<AZURE_BACKEND_CLIENT_ID>/data.read
AZURE_APP_SCOPE           = api://<AZURE_BACKEND_CLIENT_ID>/.default
```

---

## 2. Run Locally — Clone from GitHub

Uses H2 in-memory database. No Docker needed. Data is lost on restart (use Docker for persistence).

> **Before you start:** Complete [Azure AD Setup](#1-azure-ad-setup--do-this-first-15-min) and have your four Azure values ready.

---

### Step 1 — Verify prerequisites

Run in any terminal:

```bash
java -version    # need 17 or higher
mvn -version     # need 3.9 or higher
node -version    # need 20 or higher
```

All three must print a version number. Install any that are missing before continuing:
- Java 17: [adoptium.net](https://adoptium.net)
- Maven 3.9: [maven.apache.org/download.cgi](https://maven.apache.org/download.cgi)
- Node.js 20: [nodejs.org](https://nodejs.org)

---

### Step 2 — Clone the repository

```bash
git clone https://github.com/<your-username>/azure-msal-nextjs-springboot-demo.git
cd azure-msal-nextjs-springboot-demo
```

---

### Step 3 — Start the Spring Boot backend

Open **Terminal 1** in the project root and run:

**Windows (PowerShell):**
```powershell
cd backend
$env:AZURE_TENANT_ID         = "your-tenant-id"
$env:AZURE_BACKEND_CLIENT_ID = "your-backend-client-id"
$env:FRONTEND_URL            = "http://localhost:3000"
mvn spring-boot:run
```

**Linux / macOS (bash):**
```bash
cd backend
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_BACKEND_CLIENT_ID="your-backend-client-id"
export FRONTEND_URL="http://localhost:3000"
mvn spring-boot:run
```

First run downloads Maven dependencies (~2 min). Wait for this line before continuing:
```
Started MsalDemoApplication in X.XXX seconds
```

---

### Step 4 — Verify the backend is healthy

Open **Terminal 2** (keep Terminal 1 running with Spring Boot).

```bash
curl http://localhost:8080/actuator/health
```

Expected: `{"status":"UP"}`

If the backend is up but Azure values are wrong, it will still return UP — the JWT validation error only appears when a real token is sent.

---

### Step 5 — Configure the Next.js frontend

In **Terminal 2**, from the project root:

**Windows (PowerShell):**
```powershell
cd frontend
copy .env.local.example .env.local
```

**Linux / macOS (bash):**
```bash
cd frontend
cp .env.local.example .env.local
```

Open `.env.local` in a text editor and fill in **all** values:

```env
# ── BROWSER-SAFE (baked into the JS bundle at npm run build) ────────────────
NEXT_PUBLIC_AZURE_TENANT_ID=your-tenant-id
NEXT_PUBLIC_AZURE_CLIENT_ID=your-frontend-client-id
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_BACKEND_SCOPE=api://your-backend-client-id/data.read
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080

# ── SERVER-ONLY (never sent to the browser) ─────────────────────────────────
AZURE_CLIENT_ID=your-frontend-client-id
AZURE_CLIENT_SECRET=your-client-secret-value
AZURE_TENANT_ID=your-tenant-id
AZURE_APP_SCOPE=api://your-backend-client-id/.default
```

Replace every `your-*` placeholder. The `BACKEND_CLIENT_ID` in the scope/app scope lines is the **backend** app registration ID, not the frontend one.

---

### Step 6 — Install frontend dependencies

```bash
npm install
```

Takes ~1 minute on first run.

---

### Step 7 — Start the Next.js frontend

```bash
npm run dev
```

Wait for:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
✓ Ready in X.Xs
```

---

### Step 8 — Test both token flows in the browser

Open **http://localhost:3000**.

**Test 1 — Application token (no login):**
- The public page loads automatically with a list of items from Spring Boot.
- You should see: `Token type used: application (client credentials)`
- If you see "Could not load data", the backend is not reachable — check Terminal 1.

**Test 2 — User token with Admin role:**
- Click **Sign in with Microsoft**.
- Sign in with your **Admin** test user in the popup.
- You land on `/dashboard` showing your name, email, Azure Object ID, scopes, role badge, and the red **Admin Panel**.

**Test 3 — User role (no admin panel):**
- Click **Sign out (me)** → **Sign in with Microsoft** → sign in with your **regular User** account.
- Dashboard loads but the Admin Panel section is not visible.

---

### Local dev troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `java: command not found` | Java not installed or not on PATH | Install Java 17 from [adoptium.net](https://adoptium.net) |
| `mvn: command not found` | Maven not installed | Install from [maven.apache.org](https://maven.apache.org/download.cgi) and add to PATH |
| `node: command not found` | Node.js not installed | Install from [nodejs.org](https://nodejs.org) |
| Backend fails to start | Wrong tenant ID or client ID | Check env var values — no quotes, no trailing spaces |
| `{"status":"UP"}` but public page shows "Could not load data" | Wrong `AZURE_BACKEND_CLIENT_ID` — JWT audience mismatch | Backend logs show `Invalid audience` — fix the client ID value |
| Login popup never opens | Popup blocker | Allow popups for `localhost:3000` in your browser |
| `AADSTS50011` error in popup | `http://localhost:3000` not registered in Azure | Add it to `msal-demo-frontend` → Authentication → SPA redirect URIs |
| Dashboard loads but is empty / 403 | `NEXT_PUBLIC_BACKEND_SCOPE` wrong | Must be exactly `api://<BACKEND_CLIENT_ID>/data.read` |
| Admin Panel missing for Admin user | User not assigned Admin role | Enterprise apps → msal-demo-backend → Users and groups → assign Admin role |
| `scp` claim missing, 403 on dashboard | Scope not included in login request | `NEXT_PUBLIC_BACKEND_SCOPE` must be set before `npm run dev` — restart after changing `.env.local` |

---

## 3. Run with Docker (recommended)

Starts PostgreSQL + Spring Boot + Next.js with a single command. Data persists across restarts.

**Prerequisite:** Docker Desktop running.

### Step 1 — Configure

```bash
git clone https://github.com/<your-username>/azure-msal-nextjs-springboot-demo.git
cd azure-msal-nextjs-springboot-demo

cp .env.dev.example .env.dev         # Linux/macOS
# Windows: copy .env.dev.example .env.dev
```

Edit `.env.dev` and fill in your Azure AD values. The PostgreSQL credentials (`POSTGRES_USER`, `POSTGRES_PASSWORD`) default values are fine for local dev.

### Step 2 — Build and start

```bash
docker compose --env-file .env.dev up --build
```

First build takes 3–5 minutes. Open **http://localhost:3000** when Next.js logs show `Ready`.

### Useful Docker commands

```bash
# Stop, keep DB data
docker compose down

# Stop and wipe DB data
docker compose down -v

# Rebuild after code changes
docker compose --env-file .env.dev up --build --force-recreate

# Follow logs for one service
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 4. Run from DockerHub — no code clone needed

Run the app without cloning or building anything.

> **Important:** The frontend Docker image has Azure AD values **baked in** at build time (`NEXT_PUBLIC_*` vars are compiled into the JS bundle). Pulling someone else's image means using **their** Azure AD tenant — you cannot change those values at runtime. To use your own tenant, build your own frontend image (commands below).

### Step 1 — Download the files

```bash
mkdir msal-demo && cd msal-demo

curl -O https://raw.githubusercontent.com/<your-username>/azure-msal-nextjs-springboot-demo/main/docker-compose.prod.yml
curl -O https://raw.githubusercontent.com/<your-username>/azure-msal-nextjs-springboot-demo/main/.env.prod.example
```

### Step 2 — Configure

```bash
cp .env.prod.example .env.prod       # Linux/macOS
# Windows: copy .env.prod.example .env.prod
```

Edit `.env.prod`:
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_BACKEND_CLIENT_ID=your-backend-client-id
AZURE_CLIENT_ID=your-frontend-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_APP_SCOPE=api://your-backend-client-id/.default
FRONTEND_URL=http://localhost:3000

SPRING_DATASOURCE_URL=jdbc:postgresql://your-host/your-db?sslmode=require
SPRING_DATASOURCE_USERNAME=your-db-user
SPRING_DATASOURCE_PASSWORD=your-db-password

DOCKERHUB_USERNAME=the-image-owner-username
```

### Step 3 — Pull and run

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

```bash
docker compose -f docker-compose.prod.yml logs -f    # view logs
docker compose -f docker-compose.prod.yml down        # stop
```

Open **http://localhost:3000**.

### Build your own images

Required to use your own Azure AD tenant.

**Backend (universal — no baked-in values):**
```bash
cd backend
docker build -t your-dockerhub-username/msal-demo-backend:latest .
docker push your-dockerhub-username/msal-demo-backend:latest
```

**Frontend for local use:**
```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_AZURE_TENANT_ID="your-tenant-id" \
  --build-arg NEXT_PUBLIC_AZURE_CLIENT_ID="your-frontend-client-id" \
  --build-arg NEXT_PUBLIC_REDIRECT_URI="http://localhost:3000" \
  --build-arg NEXT_PUBLIC_BACKEND_SCOPE="api://your-backend-client-id/data.read" \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL="http://localhost:8080" \
  -t your-dockerhub-username/msal-demo-frontend:latest .
docker push your-dockerhub-username/msal-demo-frontend:latest
```

**Frontend for production (pointing to Render + Vercel):**
```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_AZURE_TENANT_ID="your-tenant-id" \
  --build-arg NEXT_PUBLIC_AZURE_CLIENT_ID="your-frontend-client-id" \
  --build-arg NEXT_PUBLIC_REDIRECT_URI="https://your-app.vercel.app" \
  --build-arg NEXT_PUBLIC_BACKEND_SCOPE="api://your-backend-client-id/data.read" \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL="https://your-backend.onrender.com" \
  -t your-dockerhub-username/msal-demo-frontend:prod .
docker push your-dockerhub-username/msal-demo-frontend:prod
```

---

## 5. Deploy to Production — Free

Complete free stack: **Neon** (DB) + **Render** (backend) + **Vercel** (frontend). Do them in this order.

---

### Step A — Neon (database)

1. Sign up at [neon.tech](https://neon.tech) — free, no credit card.
2. Click **New project** → name it `msal-demo` → pick a region close to your Render region → **Create project**.
3. On the dashboard, click **Connection string** → switch format to **JDBC**.
4. Copy the string — it looks like:
   ```
   jdbc:postgresql://ep-xyz.us-east-2.aws.neon.tech/neondb?user=neondb_owner&password=xxxxx&sslmode=require
   ```
5. Save these three values for use in Render:
   ```
   SPRING_DATASOURCE_URL      = jdbc:postgresql://...?sslmode=require
   SPRING_DATASOURCE_USERNAME = neondb_owner
   SPRING_DATASOURCE_PASSWORD = your-neon-password
   ```

---

### Step B — Render (backend)

Push your code to GitHub first (if not already):
```bash
git remote add origin https://github.com/<your-username>/azure-msal-nextjs-springboot-demo.git
git push -u origin main
```

**Deploy with the included Blueprint (`render.yaml`):**

1. Go to [dashboard.render.com](https://dashboard.render.com) → sign in.
2. Click **New +** → **Blueprint**.
3. Connect GitHub → select the `azure-msal-nextjs-springboot-demo` repo → click **Connect**.
4. Render detects `render.yaml`. On the next screen, fill in the environment variables:

   | Variable | Value |
   |---|---|
   | `AZURE_TENANT_ID` | your-tenant-id |
   | `AZURE_BACKEND_CLIENT_ID` | your-backend-client-id |
   | `FRONTEND_URL` | `https://your-app.vercel.app` ← temporary placeholder, update after Vercel deploy |
   | `SPRING_DATASOURCE_URL` | your Neon JDBC URL |
   | `SPRING_DATASOURCE_USERNAME` | your Neon username |
   | `SPRING_DATASOURCE_PASSWORD` | your Neon password |

5. Click **Apply**. First deploy takes 3–5 minutes.
6. Once deployed, your backend URL is: `https://msal-demo-backend.onrender.com`

Verify it is up:
```bash
curl https://msal-demo-backend.onrender.com/actuator/health
# Expected: {"status":"UP"}
```

> **Free-tier note:** Render free plan sleeps after 15 min of inactivity. First request after wake takes 20–30 s. Upgrade to Starter ($7/mo) to remove this.

---

### Step C — Vercel (frontend)

**You need the Render URL from Step B before this step.**

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub.
2. Click **Add New Project** → select the `azure-msal-nextjs-springboot-demo` repo.
3. **Root Directory:** click **Edit** and set it to `frontend`.
4. **Framework Preset:** Next.js (auto-detected).
5. Expand **Environment Variables** and add every variable in the table below:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_AZURE_TENANT_ID` | your-tenant-id |
   | `NEXT_PUBLIC_AZURE_CLIENT_ID` | your-**frontend**-client-id |
   | `NEXT_PUBLIC_REDIRECT_URI` | `https://your-project.vercel.app` ← use your Vercel preview URL, or set a custom domain |
   | `NEXT_PUBLIC_BACKEND_SCOPE` | `api://your-backend-client-id/data.read` |
   | `NEXT_PUBLIC_BACKEND_API_URL` | `https://msal-demo-backend.onrender.com` |
   | `AZURE_CLIENT_ID` | your-**frontend**-client-id |
   | `AZURE_CLIENT_SECRET` | your-client-secret |
   | `AZURE_TENANT_ID` | your-tenant-id |
   | `AZURE_APP_SCOPE` | `api://your-backend-client-id/.default` |
   | `BACKEND_INTERNAL_URL` | `https://msal-demo-backend.onrender.com` |

6. Click **Deploy**. First deploy takes 1–2 minutes.
7. Copy your Vercel URL, e.g.: `https://msal-demo-abc123.vercel.app`

---

### Step D — Final wiring (2 quick steps)

Now that you have the Vercel URL, wire it into Azure and Render:

#### 1. Register the Vercel redirect URI in Azure

1. Go to [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → `msal-demo-frontend`.
2. Click **Authentication** → under **Single-page application** → **Add URI**.
3. Enter: `https://your-project.vercel.app`
4. Click **Save**.

#### 2. Update FRONTEND_URL on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) → `msal-demo-backend` → **Environment**.
2. Change `FRONTEND_URL` to `https://your-project.vercel.app`.
3. Click **Save changes** — Render redeploys in ~1 minute.

> If `NEXT_PUBLIC_REDIRECT_URI` differs from the actual URL you visit, login will fail with `AADSTS50011`. Azure must have the exact URL registered.

---

## 6. View the Live Demo

Open your Vercel URL in a browser — desktop or mobile:

1. **Public page** loads automatically. Data comes from Spring Boot via an application (machine) token — no login needed.
2. Click **Sign in with Microsoft** → authenticate with your Admin test user.
3. You land on the **Dashboard** — shows your name, email, Azure Object ID, token scopes, role badges, and metric cards.
4. The **Admin Panel** (red section) is visible only to users with the `Admin` role.
5. Log out → sign in with the regular User account → Admin Panel is gone.

**Sharing with recruiters:** send the Vercel URL. The public page works without credentials. To demo the dashboard, share one test user account or walk through it live.

---

## 7. Run Tests

All tests run without a live Azure AD connection.

```bash
# Backend — JUnit 5 + MockMvc (no Azure needed)
cd backend
mvn test

# Frontend — Jest + RTL + MSW (no Azure needed)
cd frontend
npm install
npm test

# Frontend coverage report
cd frontend
npm run test:coverage

# E2E — Playwright (requires app running at http://localhost:3000)
cd e2e
npm install
npx playwright test

# E2E with visible browser
npx playwright test --headed
```

---

## 8. Project Structure

```
├── backend/                          Spring Boot 3 REST API
│   ├── src/main/java/.../
│   │   ├── config/
│   │   │   ├── SecurityConfig.java       JWT validation + CORS + route auth
│   │   │   ├── AudienceValidator.java    Validates 'aud' claim
│   │   │   └── AzureJwtGrantedAuthoritiesConverter.java  scp→SCOPE_*, roles→ROLE_*
│   │   ├── controller/
│   │   │   ├── PublicController.java     GET /api/public/data  (app token)
│   │   │   └── DashboardController.java  GET /api/dashboard/*  (user token)
│   │   ├── entity/DataItem.java          JPA entity
│   │   └── repository/DataItemRepository.java
│   ├── src/main/resources/
│   │   ├── application.yml               Config (H2 default, PostgreSQL via env)
│   │   └── data.sql                      Seed data (idempotent WHERE NOT EXISTS)
│   └── Dockerfile                        Multi-stage Maven → JRE Alpine
│
├── frontend/                         Next.js 14 — responsive, mobile-ready
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              Public page (Server Component)
│   │   │   ├── dashboard/page.tsx    Protected dashboard
│   │   │   └── api/public-data/route.ts  Server route — acquires app token
│   │   ├── components/
│   │   │   ├── LoginButton.tsx       MSAL login/logout (mobile-safe username)
│   │   │   ├── Dashboard.tsx         Responsive grid, scrollable admin table
│   │   │   └── MsalProviderWrapper.tsx  MSAL context provider
│   │   └── lib/
│   │       ├── msalConfig.ts         MSAL Browser config (NEXT_PUBLIC_ vars)
│   │       └── tokenService.ts       MSAL Node app-token client (server-only)
│   └── Dockerfile                    Multi-stage Node → standalone output
│
├── e2e/                              Playwright E2E tests
├── docker-compose.yml                Dev: build from source + local PostgreSQL
├── docker-compose.prod.yml           Prod: pull from DockerHub + Neon
├── render.yaml                       Render Blueprint (backend auto-deploy)
├── vercel.json                       Vercel config (frontend auto-deploy)
├── AZURE_SETUP.md                    ← Azure portal walkthrough (start here)
├── DEPLOYMENT.md                     ← Full deployment guide
├── DOCKER.md                         ← Docker build/push/run commands
├── SPEC.md                           ← Architecture + API reference
└── CONTEXT.md                        ← AI model / developer handoff
```

---

## 9. Environment Variables Reference

### Frontend

| Variable | Scope | Value |
|---|---|---|
| `NEXT_PUBLIC_AZURE_TENANT_ID` | **Build time** | Your Azure tenant ID |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | **Build time** | Frontend app registration client ID |
| `NEXT_PUBLIC_REDIRECT_URI` | **Build time** | OAuth redirect URI — must match Azure portal exactly |
| `NEXT_PUBLIC_BACKEND_SCOPE` | **Build time** | `api://<backend-id>/data.read` |
| `NEXT_PUBLIC_BACKEND_API_URL` | **Build time** | Spring Boot public URL |
| `AZURE_CLIENT_ID` | Runtime | Frontend client ID (server-side only) |
| `AZURE_CLIENT_SECRET` | Runtime | **Secret — never in NEXT_PUBLIC_*, never committed** |
| `AZURE_TENANT_ID` | Runtime | Tenant ID (server-side only) |
| `AZURE_APP_SCOPE` | Runtime | `api://<backend-id>/.default` |
| `BACKEND_INTERNAL_URL` | Runtime | Docker-internal backend URL (Next.js server → Spring Boot) |

### Backend

| Variable | Value |
|---|---|
| `AZURE_TENANT_ID` | Used to validate JWT issuer |
| `AZURE_BACKEND_CLIENT_ID` | Used to validate JWT audience |
| `FRONTEND_URL` | Allowed CORS origin — no trailing slash |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL (omit = H2 in-memory) |
| `SPRING_DATASOURCE_USERNAME` | DB username |
| `SPRING_DATASOURCE_PASSWORD` | DB password |

---

## 10. Mobile / Responsive

The frontend is built with Tailwind CSS and is fully responsive on phones, tablets, and desktop:

- **Header** — logo and sign-in/out button at all sizes; email is hidden on mobile ("Sign out (me)")
- **Home page** — single-column layout, heading scales `text-2xl` → `text-4xl` at `sm:` breakpoint
- **Dashboard metrics** — single column on mobile (`grid-cols-1`), two columns on tablet+ (`sm:grid-cols-2`)
- **Admin panel table** — horizontally scrollable on narrow screens (`overflow-x-auto`)
- **Role badges and health tags** — `flex-wrap` so they stack on small screens

Test it on your phone by opening the Vercel URL — no app install needed.

---

## 11. Documentation

| File | Contents |
|---|---|
| [`AZURE_SETUP.md`](./AZURE_SETUP.md) | Azure portal walkthrough — registrations, scopes, roles, users, multi-environment |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Full deployment guide with all env var tables |
| [`DOCKER.md`](./DOCKER.md) | Docker build, push, pull, and run commands |
| [`SPEC.md`](./SPEC.md) | Architecture diagram, API reference, JWT claim mapping |
| [`CONTEXT.md`](./CONTEXT.md) | Developer / AI model handoff document |
| [`CLAUDE.md`](./CLAUDE.md) | Claude Code / Cowork session context (run commands, gotchas) |

---

## 12. Validated Issues and Fixes (Real Setup Session)

All issues below were encountered and fixed during a real end-to-end setup on Windows 11 with Java 21 / Maven 3.9 / Node.js 22. Use this as a reference if you hit the same errors.

---

### Azure AD Issues

#### Tenant blocked — AADSTS5000225
**Error:** `The tenant 'Casa' has been deauthenticated and is no longer available`
**Cause:** Free Azure AD tenants are blocked after extended inactivity.
**Fix:** Create a new tenant — Azure portal → Microsoft Entra ID → Manage tenants → + Create → Azure Active Directory.
**Prevention:** Log into `portal.azure.com` at least once a month. Set a recurring calendar reminder.

---

#### Personal @outlook.com account cannot create app registrations
**Error:** `The ability to create applications outside of a directory has been deprecated`
**Cause:** Personal Microsoft accounts (@outlook.com, @hotmail.com) don't have a proper Azure AD directory by default.
**Fix:** Create a proper organizational tenant first — Azure portal → Microsoft Entra ID → Manage tenants → + Create → Azure Active Directory.

---

#### Wrong Tenant ID — AADSTS700016
**Error:** `Application was not found in the directory 'Microsoft Services'`
**Cause:** The Azure portal defaults to the "Microsoft Services" tenant when multiple accounts are signed in. The Tenant ID shown there (`f8cdef...`) is NOT your tenant.
**Fix:**
1. Sign out of all Microsoft accounts in the browser.
2. Sign back in with **only** the account that owns your Azure AD tenant.
3. Go to Microsoft Entra ID → Overview → copy the Tenant ID shown there.
**Key check:** The primary domain shown should match your tenant's `.onmicrosoft.com` domain.

---

#### Client Secret ID vs Client Secret Value
**Error:** `AADSTS7000215: Invalid client secret provided`
**Cause:** In the Azure portal, the Certificates & secrets page shows two columns: **Secret ID** (a UUID) and **Value** (the actual secret). The **Value is only shown once** — right after creation. Copying the Secret ID by mistake causes this error.
**Fix:** Delete the old secret → create a new one → **immediately copy the Value column** (the longer string with symbols like `~`, not the UUID).

---

#### Test user login fails — "We couldn't find an account with that username"
**Cause:** The `.onmicrosoft.com` domain auto-generated from your Outlook account name can have unexpected characters (extra letters from `outlook`). For example, an Outlook account named `adalbertosilveiranapoles@outlook.com` generates the domain `adalbertosilveiranapolesoout.onmicrosoft.com` — the `out` suffix from `outlook` is appended.
**Fix:** Always copy the exact User Principal Name from the Azure portal:
1. Azure portal → Microsoft Entra ID → Users → click the user → Overview
2. Copy the **User principal name** field using the copy button
3. Paste it exactly into the login popup — do not type it manually

---

#### "Pick an account" loop instead of typing email
**Cause:** Browser has cached a Microsoft session. The login popup shows existing accounts instead of asking for credentials.
**Fix:** Click the cached account in "Pick an account" if it is the right one. If not, scroll down and click "Use another account".

---

### Spring Boot Issues

#### `next.config.ts` not supported
**Error:** `Configuring Next.js via 'next.config.ts' is not supported`
**Cause:** Next.js 14.2.x does not support TypeScript config files — only `.js` or `.mjs`.
**Fix:** Rename `next.config.ts` → `next.config.js` and remove TypeScript-specific syntax:
```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};
module.exports = nextConfig;
```

---

#### `JwtValidators.createDefaultWithValidators()` does not exist
**Error:** `cannot find symbol: method createDefaultWithValidators`
**Cause:** This method does not exist in Spring Security 6.x. The correct pattern is `DelegatingOAuth2TokenValidator`.
**Fix:**
```java
var audienceValidator = new AudienceValidator(clientId);
var defaultValidator = JwtValidators.createDefault();
decoder.setJwtValidator(
    new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
        defaultValidator, audienceValidator
    )
);
```

---

#### `data.sql` fails — Table not found
**Error:** `Table "DATA_ITEMS" not found (this database is empty)`
**Cause:** Spring Boot runs `data.sql` before Hibernate creates the schema when using H2.
**Fix:** Add to `application.yml`:
```yaml
spring:
  jpa:
    defer-datasource-initialization: true
```

---

#### JWT audience mismatch — 401 on `/api/public/data`
**Error:** HTTP 401 on the public endpoint even with a valid app token.
**Cause:** App tokens (client credentials) set the `aud` claim to `api://<clientId>` (with `api://` prefix). User tokens set `aud` to the bare UUID. The `AudienceValidator` was only checking for the bare UUID.
**Fix:** Accept both formats in `AudienceValidator`:
```java
if (audiences.contains(audience) || audiences.contains("api://" + audience)) {
    return OAuth2TokenValidatorResult.success();
}
```

---

#### `/actuator/health` returns 401
**Error:** `(401) Unauthorized` on health check endpoint.
**Cause:** `SecurityConfig` has `.anyRequest().denyAll()` which blocks the actuator.
**Fix:** Add a `permitAll()` rule before the catch-all:
```java
.requestMatchers("/actuator/health").permitAll()
```

---

#### Port 8080 already in use
**Error:** `Web server failed to start. Port 8080 was already in use`
**Cause:** A previous failed Spring Boot run left a process running.
**Fix (Windows PowerShell as Administrator):**
```powershell
netstat -ano | findstr :8080   # find the PID
taskkill /PID <PID> /F
```

---

#### `DashboardControllerTest` compilation error
**Error:** `cannot find symbol: method containsString(String) in JsonPathResultMatchers`
**Cause:** `jsonPath("$.field").containsString(...)` is invalid — `containsString` is a Hamcrest matcher, not a JsonPath method.
**Fix:**
```java
// Wrong
.andExpect(jsonPath("$.message").containsString("Administrator"));

// Correct
.andExpect(jsonPath("$.message").value(containsString("Administrator")));
```

---

### Environment Variable Issues

#### `$env:` variables are session-only (Windows)
`$env:VAR = "value"` in PowerShell sets the variable only for the current terminal session. It disappears when the terminal closes and does not affect other terminals or survive a reboot. This is intentional — secrets should not be stored permanently on disk.

To avoid setting them every session, load from a `.env.local` file (already in `.gitignore`):
```powershell
Get-Content backend\.env.local | ForEach-Object {
  if ($_ -match '^(.+)=(.+)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
  }
}
mvn spring-boot:run
```

---

#### Wrong Tenant ID after first start
If the backend starts with the wrong `AZURE_TENANT_ID`, JWT validation will fail silently with 401.
The actuator health check (`/actuator/health`) returns `{"status":"UP"}` regardless — it does not validate Azure AD config.
**Always verify** by opening `http://localhost:3000` and checking that the public data items load.

---

## License

MIT
