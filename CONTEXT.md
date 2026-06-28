# CONTEXT.md — AI Model & Developer Handoff

This file gives any developer or AI model the context needed to understand, extend, and deploy this project without prior history.

## Project summary

A working reference implementation of Azure AD authentication in a full-stack web app. Demonstrates two separate token flows coexisting in the same application, two user roles with fine-grained access control, and a complete deployment path from local dev to production (free-tier).

**Stack**: Next.js 14 + Spring Boot 3.2 + Azure Entra ID + PostgreSQL (Neon)

## What works right now

Everything listed below is implemented and passes tests:

- Public page that fetches data from the Spring Boot API without the user being logged in (using a server-side application token — client credentials flow)
- Login / logout via MSAL Browser (auth code + PKCE flow, popup)
- Dashboard visible only to authenticated users
- Admin panel within the dashboard visible only to users with the `Admin` Azure App Role
- Spring Boot validates all JWT tokens: issuer, audience, scopes, and roles
- PostgreSQL integration (H2 in local dev, Postgres in Docker, Neon in production)
- Seed data loaded from `data.sql` on every startup (idempotent)
- Docker Compose for local dev (builds from source)
- Docker Compose for production (pulls from DockerHub)
- Vercel configuration for frontend deployment
- Render Blueprint (`render.yaml`) for backend deployment
- Full test suite: Spring Boot unit + integration tests, Jest + RTL + MSW frontend tests, Playwright E2E tests

## Architecture

```
Browser
  │
  ├─[MSAL Browser]──────────────────────────────►  Azure AD
  │  auth code + PKCE                               (Entra ID)
  │  acquires user JWT                                   │
  │                                                      │ issues JWT
  ├─[user JWT]───────────────────────────────────────────┤
  │                                                      │
  ▼                                                      │
Next.js App (Vercel / Docker port 3000)                  │
  │                                                      │
  ├─[Server Component page.tsx]                          │
  │   calls /api/public-data route handler               │
  │         │                                            │
  │         ├─[MSAL Node tokenService.ts]────────────────►
  │         │  client credentials (app token)            │
  │         │                                            │ issues app JWT
  │         │◄───────────────────────────────────────────┤
  │         │                                            │
  │         ├─[app JWT]──────────────────────────────────►
  │         │                              Spring Boot backend
  │         │                              (Render / Docker port 8080)
  │         │                                 │
  │         │                                 ├── validates JWT (issuer + aud)
  │         │                                 ├── maps scp → SCOPE_*
  │         │                                 ├── maps roles → ROLE_*
  │         │◄────────────────────────────────┤
  │         │  JSON response from DB           │
  │                                            │
  ├─[Client Component Dashboard.tsx]           │
  │   acquireTokenSilent() → user JWT          │
  │   [user JWT]───────────────────────────────►
  │                                            ├── /api/dashboard/data  (SCOPE_data.read)
  │                                            └── /api/dashboard/admin (ROLE_Admin)
  │
  │                                       PostgreSQL
  │                                       (Neon in prod, H2 in local dev)
  │                                            │
  │                              Spring Boot ──┘ JPA/Hibernate
```

## Token flows in detail

### 1. Application token (client credentials)

Used by: Next.js server → Spring Boot `/api/public/data`

```
Next.js server process
  → MSAL Node ConfidentialClientApplication
  → POST /oauth2/v2.0/token with client_id + client_secret
  → Azure AD issues JWT with aud=backend-client-id, no scp claim
  → Next.js attaches as Authorization: Bearer header
  → Spring Boot validates JWT and serves response
```

Key files: `frontend/src/lib/tokenService.ts`, `frontend/src/app/api/public-data/route.ts`

### 2. User token (auth code + PKCE)

Used by: browser → Spring Boot `/api/dashboard/*`

```
User clicks Login
  → MSAL Browser opens popup
  → User authenticates with Microsoft
  → Azure AD redirects with auth code
  → MSAL Browser exchanges code for tokens (PKCE)
  → Access token stored in memory (not localStorage)
  → Dashboard.tsx calls acquireTokenSilent()
  → Attaches token as Authorization: Bearer header
  → Spring Boot validates JWT, checks SCOPE_data.read or ROLE_Admin
```

Key files: `frontend/src/lib/msalConfig.ts`, `frontend/src/components/Dashboard.tsx`

## API endpoints

| Method | Path | Auth required | Role |
|--------|------|---------------|------|
| GET | `/api/public/data` | App token or user token | Any valid JWT |
| GET | `/api/dashboard/data` | User token | `SCOPE_data.read` |
| GET | `/api/dashboard/admin` | User token | `ROLE_Admin` |
| GET | `/actuator/health` | None | Public |

## JWT claim mapping (Spring Boot)

`AzureJwtGrantedAuthoritiesConverter` converts JWT claims to Spring Security authorities:

| JWT claim | Example value | Spring authority |
|---|---|---|
| `scp` | `data.read` | `SCOPE_data.read` |
| `roles` | `Admin` | `ROLE_Admin` |
| `roles` | `User` | `ROLE_User` |

The `AudienceValidator` checks that the `aud` claim contains `AZURE_BACKEND_CLIENT_ID`. This prevents tokens issued for other apps from being accepted.

## Environment variables

Full reference in `DEPLOYMENT.md`. Key split:

- `NEXT_PUBLIC_*` — baked into JS bundle at `npm run build`. **Cannot change at runtime.** Must be Docker `--build-arg` or Vercel env var set before deploy.
- Server-only vars (`AZURE_CLIENT_SECRET`, `SPRING_DATASOURCE_*`, etc.) — injected at container startup. Safe for secrets.
- `BACKEND_INTERNAL_URL` — Docker internal service-to-service URL. Next.js server uses this inside Docker instead of the public `NEXT_PUBLIC_BACKEND_API_URL`.

## Database

- **Local dev (no Docker)**: H2 in-memory. No setup needed. Data is lost on restart.
- **Docker dev**: PostgreSQL 16 container. Data persists in `postgres_data` named volume.
- **Production (Render)**: Neon serverless PostgreSQL (free tier, neon.tech). Set `SPRING_DATASOURCE_URL` to JDBC connection string.

Schema is managed by Hibernate (`ddl-auto: update`). Seed data is in `backend/src/main/resources/data.sql` — idempotent inserts using `WHERE NOT EXISTS`.

## Deployment platforms (all free tier)

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploys on GitHub push. `vercel.json` in root. |
| Backend | Render | `render.yaml` Blueprint in root. Sleeps after 15 min on free plan. |
| Database | Neon | Serverless PostgreSQL. No credit card. |
| Auth | Azure Entra ID Free | Free tier supports unlimited users and app registrations. |
| Images | DockerHub | Free for public repos. |

## Test coverage

```
backend/src/test/
├── config/
│   ├── AudienceValidatorTest.java           (5 tests — pure unit)
│   └── AzureJwtGrantedAuthoritiesConverterTest.java  (6 tests — pure unit)
└── controller/
    ├── PublicControllerTest.java            (@WebMvcTest, 5 tests)
    └── DashboardControllerTest.java         (@WebMvcTest, 6 tests — Admin/User/403/401)

frontend/src/__tests__/
├── components/
│   ├── LoginButton.test.tsx                 (8 tests)
│   └── Dashboard.test.tsx                   (9 tests — MSW intercepts)
├── lib/tokenService.test.ts                 (5 tests — MSAL Node mock)
└── api/public-data/route.test.ts            (5 tests — route handler direct call)

e2e/tests/
├── public-page.spec.ts                      (6 tests — unauthenticated flows)
└── dashboard.spec.ts                        (9 tests — User role + Admin role)
```

## Azure AD Setup (the only manual step)

Full walkthrough: `AZURE_SETUP.md`

### What to create

| Item | Azure portal location | Result |
|---|---|---|
| `msal-demo-backend` app registration | Entra ID → App registrations → New | Defines `data.read` scope + `Admin`/`User` app roles |
| `msal-demo-frontend` app registration | Entra ID → App registrations → New | SPA platform + client secret |
| `data.read` scope | msal-demo-backend → Expose an API | `api://<BACKEND_CLIENT_ID>/data.read` |
| `Admin` app role | msal-demo-backend → App roles | Value: `Admin`, for Users/Groups |
| `User` app role | msal-demo-backend → App roles | Value: `User`, for Users/Groups |
| `data.read` API permission | msal-demo-frontend → API permissions | Delegated, with admin consent |
| Client secret | msal-demo-frontend → Certificates & secrets | Stored in `AZURE_CLIENT_SECRET` |
| Test Admin user | Entra ID → Users → New user | `admin@tenant.onmicrosoft.com` |
| Test Regular user | Entra ID → Users → New user | `user@tenant.onmicrosoft.com` |
| Role assignment (Admin) | Enterprise apps → msal-demo-backend → Users and groups | Admin user → Admin role |
| Role assignment (User) | Enterprise apps → msal-demo-backend → Users and groups | Regular user → User role |

### How roles appear in JWTs

When a user logs in via MSAL Browser:
- `Admin User` → JWT contains `"roles": ["Admin"]` → Spring Security grants `ROLE_Admin`
- `Regular User` → JWT contains `"roles": ["User"]` → Spring Security grants `ROLE_User`

The `scp: "data.read"` claim comes from the scope requested during login (set in `NEXT_PUBLIC_BACKEND_SCOPE`). Both roles get this scope; it is what allows access to `/api/dashboard/data`.

### Works across all environments

One pair of app registrations, all environments. Add all redirect URIs to the frontend app registration — Azure matches whichever one the request uses:
- `http://localhost:3000` — local dev + Docker local
- `https://your-app.vercel.app` — production (add after first Vercel deploy)

### DockerHub constraint

The frontend Docker image bakes `NEXT_PUBLIC_*` vars at build time. Anyone pulling the image from DockerHub cannot change those values. They must build their own frontend image with their Azure AD values to use their own tenant.

The backend image is universal — every config value is a runtime env var.

## Where to find things

| Topic | File |
|---|---|
| **Azure portal setup — start here** | `AZURE_SETUP.md` |
| Public repo entry point | `README.md` |
| Docker build, push, pull commands | `DOCKER.md` |
| Full deployment guide (Vercel, Render, Neon) | `DEPLOYMENT.md` |
| Architecture diagram + API reference | `SPEC.md` |
| Run commands, project structure, gotchas | `CLAUDE.md` |
| JWT security config | `backend/src/main/java/.../config/SecurityConfig.java` |
| MSAL Browser config | `frontend/src/lib/msalConfig.ts` |
| App token acquisition | `frontend/src/lib/tokenService.ts` |

## Known limitations

1. **Render cold starts** — free plan sleeps after 15 min of inactivity. First request after wake takes 20-30 seconds. Upgrade to Starter ($7/mo) to remove this.
2. **Frontend image is environment-specific** — because `NEXT_PUBLIC_*` vars are baked at build time, anyone running the DockerHub frontend image must use the builder's Azure AD tenant. Each team should build their own frontend image. The backend image is universal.
3. **No refresh token rotation** — MSAL Browser handles token refresh automatically via silent renewal. If the popup appears unexpectedly, it means the silent renewal failed (network, consent, or session expiry).
4. **H2 data.sql compatibility** — H2 supports most PostgreSQL SQL syntax but not all. The seed file uses standard SQL that works on both. If you add complex queries, test them against H2.
5. **Neon connection pooling** — Neon uses serverless branching. For high concurrency, configure Spring Boot's HikariCP pool size to match Neon's free tier limit (max 10 connections).
