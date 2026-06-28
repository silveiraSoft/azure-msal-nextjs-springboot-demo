# CLAUDE.md — Project context for Claude Code / Cowork

This file is loaded automatically by Claude in every session on this repo.

## What this project is

Full-stack Azure AD / MSAL authentication demo:
- **Frontend**: Next.js 14 (App Router) — login page + dashboard
- **Backend**: Spring Boot 3 (Java 17) — REST API with JWT validation
- **Auth**: Azure Entra ID (formerly Azure AD) — OAuth 2.0 / OIDC
- **DB**: H2 (local dev), PostgreSQL (Docker), Neon (production)

Two distinct token flows run simultaneously:
1. **App token** (client credentials): Next.js server fetches backend `/api/public/data` without requiring user login
2. **User token** (auth code + PKCE): MSAL Browser logs the user in, acquires a delegated token, hits `/api/dashboard/*`

Two roles: `Admin` and `User` — defined as Azure App Roles on the backend app registration.

## Key constraint: NEXT_PUBLIC_ vars are baked at build time

Next.js bakes `NEXT_PUBLIC_` env vars into the JS bundle during `npm run build`. They **cannot** be changed at runtime. Always pass them as Docker `--build-arg` or set them in Vercel before deploying.

## Run commands

### Local dev (no Docker) — step by step

**Step 1: Check prerequisites**
```bash
java -version   # need 17+
mvn -version    # need 3.9+
node -version   # need 20+
```

**Step 2: Start backend — Terminal 1**

Windows (PowerShell):
```powershell
cd backend
$env:AZURE_TENANT_ID         = "your-tenant-id"
$env:AZURE_BACKEND_CLIENT_ID = "your-backend-client-id"
$env:FRONTEND_URL            = "http://localhost:3000"
mvn spring-boot:run
# Wait for: Started MsalDemoApplication in X.XXX seconds
```

Linux / macOS:
```bash
cd backend
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_BACKEND_CLIENT_ID="your-backend-client-id"
export FRONTEND_URL="http://localhost:3000"
mvn spring-boot:run
# Wait for: Started MsalDemoApplication in X.XXX seconds
```

**Step 3: Verify backend health — Terminal 2**
```bash
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}
```

**Step 4: Configure frontend — Terminal 2**
```bash
cd frontend
cp .env.local.example .env.local    # Linux/macOS
# Windows: copy .env.local.example .env.local

# Fill in .env.local — all 9 values required (see below)
```

**Step 5: Install and run frontend — Terminal 2**
```bash
npm install
npm run dev
# Wait for: ✓ Ready in X.Xs  →  open http://localhost:3000
```

**Step 6: Smoke test in browser**
- Public page loads with items → app token working ✓
- Click Sign in → Admin user → Dashboard + Admin Panel visible ✓
- Sign out → regular User → Dashboard only, no Admin Panel ✓

### Docker dev (with real PostgreSQL)

```bash
cp .env.dev.example .env.dev   # fill in values
docker compose --env-file .env.dev up --build
```

### Run tests

```bash
# Backend unit + integration tests
cd backend && mvn test

# Frontend unit tests
cd frontend && npm test
cd frontend && npm run test:coverage

# E2E tests (requires app running at localhost:3000)
cd e2e && npm install && npx playwright test
```

## Project structure

```
├── backend/
│   ├── src/main/java/com/example/msaldemo/
│   │   ├── config/
│   │   │   ├── SecurityConfig.java          # JWT resource server, CORS, route auth
│   │   │   ├── AudienceValidator.java        # validates 'aud' claim
│   │   │   └── AzureJwtGrantedAuthoritiesConverter.java  # scp → SCOPE_*, roles → ROLE_*
│   │   ├── controller/
│   │   │   ├── PublicController.java         # /api/public/data — reads from DataItemRepository
│   │   │   └── DashboardController.java      # /api/dashboard/* (user token)
│   │   ├── entity/
│   │   │   └── DataItem.java                # @Entity → data_items table (id, title, description)
│   │   └── repository/
│   │       └── DataItemRepository.java       # extends JpaRepository<DataItem, Long>
│   ├── src/main/resources/
│   │   ├── application.yml                  # all config; H2 default, PostgreSQL via SPRING_DATASOURCE_*
│   │   └── data.sql                         # idempotent seed (INSERT WHERE NOT EXISTS, 5 rows)
│   └── Dockerfile                           # multi-stage Maven → JRE alpine
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                     # public page (Server Component)
│   │   │   ├── dashboard/page.tsx           # protected dashboard
│   │   │   └── api/public-data/route.ts     # Route Handler — fetches backend with app token
│   │   ├── components/
│   │   │   ├── LoginButton.tsx              # MSAL login/logout (Client Component)
│   │   │   └── Dashboard.tsx               # user dashboard (Client Component)
│   │   └── lib/
│   │       ├── msalConfig.ts               # MSAL Browser config (NEXT_PUBLIC_ vars)
│   │       └── tokenService.ts             # MSAL Node confidential client (server only)
│   └── Dockerfile                          # multi-stage Node → standalone output
│
├── e2e/                                    # Playwright E2E tests
├── docker-compose.yml                      # dev: builds from source + local Postgres
├── docker-compose.prod.yml                 # prod: pulls from DockerHub + Neon
├── render.yaml                             # Render Blueprint for backend deploy
├── vercel.json                             # Vercel config for frontend deploy
├── DEPLOYMENT.md                           # step-by-step deploy guide
├── AZURE_SETUP.md                          # Azure portal walkthrough
├── DOCKER.md                               # Docker build/push/run guide
└── SPEC.md                                 # full architecture spec
```

## Key patterns

### App token flow (server-side, Next.js → Spring Boot)
`frontend/src/app/api/public-data/route.ts` calls `getAppToken()` from `tokenService.ts` (MSAL Node confidential client, client credentials grant). Uses `BACKEND_INTERNAL_URL` inside Docker, falls back to `NEXT_PUBLIC_BACKEND_API_URL` outside Docker.

### User token flow (browser)
`Dashboard.tsx` calls `acquireTokenSilent()` → falls back to `acquireTokenPopup()`. Passes the token as `Authorization: Bearer` header to the backend.

### JWT validation (Spring Boot)
`SecurityConfig.java` wires a custom `JwtDecoder` bean that validates issuer + audience. `AzureJwtGrantedAuthoritiesConverter` maps `scp` claims → `SCOPE_*` authorities and `roles` claims → `ROLE_*` authorities.

### Database layer (Spring Boot)
Three environments, one codebase — controlled entirely by env vars:
- **H2 in-memory** (default, no env vars needed) — local dev without Docker; data lost on restart
- **PostgreSQL 16 container** — Docker dev; `SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/msaldb`
- **Neon** — production; `SPRING_DATASOURCE_URL=jdbc:postgresql://ep-xyz.neon.tech/neondb?sslmode=require`

Schema managed by Hibernate (`ddl-auto: update`) — no migration tool needed. Seed data in `data.sql` uses `INSERT WHERE NOT EXISTS` (idempotent). `PublicController` fetches items via `dataItemRepository.findAll()`. Tests mock the repository with `@MockBean DataItemRepository`.

### Testing patterns
- Backend: `@WebMvcTest` + `@MockBean JwtDecoder` + `@MockBean DataItemRepository` + `jwt()` post-processor (avoids live Azure AD and DB calls)
- Frontend: Jest + MSW v2 for API mocking, manual `@azure/msal-react` mock in `src/__mocks__/`
- E2E: Playwright `storageState` for auth bypass (injects fake MSAL token into sessionStorage)

## Environment variables

See `DEPLOYMENT.md` → Environment variable quick reference for the full table.

The key split:
- `NEXT_PUBLIC_*` → baked at build time (browser-visible, Docker build args)
- Everything else → injected at runtime (server-only, safe for secrets)
- `BACKEND_INTERNAL_URL` → Docker internal URL (Next.js server → Spring Boot, not exposed to browser)

## Common gotchas

1. **"Audience mismatch"** — `AZURE_BACKEND_CLIENT_ID` must match the backend app registration's Application ID exactly.
2. **"CORS error"** — `FRONTEND_URL` in backend must match the exact origin the browser sends (no trailing slash).
3. **Login popup blocked** — MSAL popup requires a user gesture. The login button's click handler triggers it directly.
4. **Render cold start** — free tier sleeps after 15 min. First request after wake takes ~30s.
5. **NEXT_PUBLIC_ not updating** — You changed an env var but the behavior didn't change. These are baked at build time — you must rebuild the Docker image or redeploy on Vercel.
6. **`roles` claim missing from JWT** — User was not assigned an app role in Enterprise applications → msal-demo-backend → Users and groups. Without assignment, the `roles` claim is absent and the user sees only 403 on admin endpoints.
7. **`scp` claim missing** — The browser MSAL login request must include `NEXT_PUBLIC_BACKEND_SCOPE` (`api://<id>/data.read`) in `loginRequest.scopes`. Without it, the user token has no `scp` claim and Spring Boot returns 403 on dashboard endpoints.
8. **`AADSTS50011` on login** — The `NEXT_PUBLIC_REDIRECT_URI` (or the production URL) is not registered in Azure portal → msal-demo-frontend → Authentication → SPA redirect URIs.
9. **App token fails** — `AZURE_APP_SCOPE` must end in `/.default` (e.g., `api://<BACKEND_CLIENT_ID>/.default`), not `data.read`. The `/.default` suffix requests all app roles granted to the frontend service principal.
10. **DockerHub frontend image is environment-specific** — `NEXT_PUBLIC_*` vars are baked in at build time. Users pulling the image from DockerHub must build their own frontend image to use their own Azure AD tenant. See `AZURE_SETUP.md` → Step 5 → Running DockerHub images.

## Azure AD quick reference

Full guide: `AZURE_SETUP.md`

Two app registrations required:
- `msal-demo-backend` — defines `data.read` scope + `Admin`/`User` app roles
- `msal-demo-frontend` — SPA platform, client secret, grants `data.read` permission

Two test users required:
- Assigned `Admin` role → sees admin panel, gets `"roles": ["Admin"]` in JWT
- Assigned `User` role → sees dashboard only, gets `"roles": ["User"]` in JWT

The same Azure configuration works for local dev, Docker, and production. Add all redirect URIs to the frontend app registration — Azure uses whichever one matches the login request.
