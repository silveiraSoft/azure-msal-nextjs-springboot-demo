# Project Specification — azure-msal-nextjs-springboot-demo

> **Purpose of this file:** Full handoff document for any developer or AI model
> picking up this project. Read this before touching any code.
>
> **Last updated:** 2026-06-27  
> **Author:** Adalberto (adalbertosn1982@gmail.com)  
> **Status:** Base implementation complete. Azure not yet configured. Not yet deployed.

---

## 1. What This Project Is

A working demonstration of Microsoft Azure AD (Entra ID) authentication integrated into:

- A **Next.js 14** frontend (App Router, TypeScript, Tailwind CSS)
- A **Spring Boot 3** REST API backend (Java 17, OAuth2 Resource Server)

It demonstrates two authentication patterns that coexist in the same application:

| Pattern | Who initiates | Token type | Typical use |
|---|---|---|---|
| **Client Credentials** | Next.js server | Application token | Machine-to-machine, public data, no user needed |
| **Authorization Code + PKCE** | Browser (MSAL.js) | User (delegated) token | Login, personalized data, role-based UI |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Next.js App (port 3000)                                 │   │
│  │                                                          │   │
│  │  / (home page)          /dashboard                       │   │
│  │  Server Component       Client Component                 │   │
│  │  ↓ fetch /api/public-data  ↓ acquireTokenSilent()        │   │
│  └──────────┬───────────────────────┬────────────────────── ┘   │
│             │                       │ Bearer <user_token>        │
│             │ (same server)         └──────────────────────────→ │
│             ↓                                                     │
│  ┌──────────────────────────────┐   ┌───────────────────────┐   │
│  │  Next.js API Route           │   │  Spring Boot (8080)    │   │
│  │  /api/public-data            │   │                        │   │
│  │                              │   │  GET /api/public/data  │   │
│  │  MSAL Node                   │   │  → .authenticated()    │   │
│  │  ConfidentialClientApp       │   │                        │   │
│  │  acquireTokenByClientCred()  │   │  GET /api/dashboard/data│   │
│  │                              │   │  → SCOPE_data.read     │   │
│  │  Bearer <app_token>    ──────┼──→│                        │   │
│  └──────────────────────────────┘   │  GET /api/dashboard/admin│  │
│                                     │  → ROLE_Admin          │   │
└─────────────────────────────────────┴───────────────────────┘   │
                                                                    │
         ┌──────────────────────────────────────────────┐          │
         │  Microsoft Entra ID (Azure AD)               │          │
         │                                              │          │
         │  • Issues app token  (client_credentials)   │          │
         │  • Issues user token (auth code + PKCE)     │          │
         │  • Publishes JWKS for Spring Boot validation │          │
         └──────────────────────────────────────────────┘          
```

### Request flow — public page (no login)

1. Browser loads `/`
2. Next.js server calls its own route `/api/public-data`
3. Route handler calls `getAppToken()` → MSAL Node → Azure AD → app JWT
4. Route handler calls Spring Boot `/api/public/data` with `Authorization: Bearer <app_token>`
5. Spring Boot validates JWT (issuer, audience, signature) → returns data
6. Next.js renders the page with that data → sent to browser

### Request flow — dashboard (user logged in)

1. User clicks "Sign in" → `instance.loginPopup(loginRequest)`
2. Azure AD popup → user authenticates → MSAL caches `access_token` + `id_token` in `sessionStorage`
3. Browser navigates to `/dashboard`
4. `Dashboard.tsx` calls `acquireTokenSilent()` → retrieves cached token (auto-refreshes if expired)
5. `fetch(BACKEND_URL/api/dashboard/data, { headers: { Authorization: "Bearer <user_token>" } })`
6. Spring Boot: validates JWT, extracts `scp` → grants `SCOPE_data.read` authority → returns data
7. If `user.roles` contains `"Admin"`: also fetches `/api/dashboard/admin` (same token)
8. Spring Boot: checks `ROLE_Admin` authority → returns or 403

---

## 3. Repository Structure

```
azure-msal-nextjs-springboot-demo/
│
├── SPEC.md                     ← THIS FILE — read first
├── AZURE_SETUP.md              ← Step-by-step Azure portal configuration
│
├── frontend/                   ← Next.js 14 application
│   ├── package.json
│   ├── next.config.ts          ← Rewrites /backend/* → Spring Boot (dev proxy)
│   ├── tsconfig.json
│   ├── .env.local.example      ← Template for all environment variables
│   │
│   └── src/
│       ├── lib/
│       │   ├── msalConfig.ts       ← PublicClientApplication config (browser)
│       │   └── tokenService.ts     ← ConfidentialClientApplication (server only)
│       │
│       ├── components/
│       │   ├── MsalProviderWrapper.tsx  ← "use client" MSAL context boundary
│       │   ├── LoginButton.tsx          ← Login/logout button (useMsal hook)
│       │   └── Dashboard.tsx            ← Protected UI, fetches with user token
│       │
│       └── app/
│           ├── layout.tsx              ← Root layout, mounts MsalProviderWrapper
│           ├── globals.css             ← Tailwind base styles
│           ├── page.tsx                ← Public home page (Server Component)
│           ├── dashboard/
│           │   └── page.tsx            ← Dashboard page (Client Component)
│           └── api/
│               └── public-data/
│                   └── route.ts        ← Server route, acquires app token
│
└── backend/                    ← Spring Boot 3 application
    ├── pom.xml
    └── src/main/
        ├── resources/
        │   ├── application.yml     ← Server config, JWT issuer URI, CORS, datasource
        │   └── data.sql            ← Seed data — idempotent INSERT WHERE NOT EXISTS
        └── java/com/example/msaldemo/
            ├── MsalDemoApplication.java
            ├── config/
            │   └── SecurityConfig.java   ← JWT validation, route authorization, CORS
            ├── entity/
            │   └── DataItem.java         ← JPA entity → data_items table
            ├── repository/
            │   └── DataItemRepository.java  ← extends JpaRepository<DataItem, Long>
            └── controller/
                ├── PublicController.java    ← GET /api/public/data (reads from DB)
                └── DashboardController.java ← GET /api/dashboard/data, /admin
```

---

## 4. Azure AD Configuration Required

> Full step-by-step instructions are in `AZURE_SETUP.md`. This is a summary.
> The Azure setup is the **only manual step** — everything else is code and Docker.

### Two app registrations needed

#### A. Backend API app (`msal-demo-backend`)

| Setting | Value |
|---|---|
| Platform | No redirect URI (it's an API) |
| Application ID URI | `api://<BACKEND_CLIENT_ID>` (auto-assigned) |
| Scopes exposed | `data.read` — full: `api://<BACKEND_CLIENT_ID>/data.read` |
| App roles | `Admin` (value: `Admin`, for Users/Groups) and `User` (value: `User`, for Users/Groups) |

#### B. Frontend app (`msal-demo-frontend`)

| Setting | Value |
|---|---|
| Platform | **Single-page application (SPA)** — required for PKCE |
| Redirect URIs | `http://localhost:3000` (dev) + `https://your-app.vercel.app` (prod) |
| API permissions (delegated) | `openid`, `profile`, `email`, `User.Read` (Graph) + `data.read` (backend) |
| Client secret | Create one — used server-side for client credentials flow only |
| Admin consent | Grant admin consent for [tenant] after adding permissions |

#### C. Create two test users and assign roles

In **Entra ID → Users → New user → Create new user**:
- `admin@<tenant>.onmicrosoft.com` — display name: `Admin User`
- `user@<tenant>.onmicrosoft.com` — display name: `Regular User`

In **Enterprise applications → msal-demo-backend → Users and groups**:
- Assign `Admin User` → role **Admin**
- Assign `Regular User` → role **User**

When users log in, Azure AD injects `"roles": ["Admin"]` or `"roles": ["User"]` into their JWT. Spring Boot maps these to `ROLE_Admin` / `ROLE_User`.

#### D. Environment variables produced

After Azure setup you will have:

```
AZURE_TENANT_ID          = <Directory (tenant) ID from any app reg overview>
AZURE_BACKEND_CLIENT_ID  = <Application (client) ID of msal-demo-backend>
AZURE_CLIENT_ID          = <Application (client) ID of msal-demo-frontend>
AZURE_CLIENT_SECRET      = <Client secret value — copy immediately after creation>
NEXT_PUBLIC_BACKEND_SCOPE = api://<BACKEND_CLIENT_ID>/data.read
AZURE_APP_SCOPE          = api://<BACKEND_CLIENT_ID>/.default
```

#### E. Works across all environments with one Azure setup

The same two app registrations work for local dev, Docker, and production because redirect URIs are additive. Add all your environment URIs to the frontend app registration:

- `http://localhost:3000` — local dev + Docker
- `https://your-app.vercel.app` — production (add after first Vercel deploy)

### What's free on Microsoft Entra ID Free tier

Everything this project needs:
- App registrations (up to 500)
- Create users in tenant (up to 50,000 objects)
- Define and assign app roles
- OAuth 2.0 / OIDC / client credentials flows
- `roles` and `scp` claims in JWT

Not needed (premium only): Conditional Access, MFA enforcement, SCIM provisioning.

### DockerHub users — important note on frontend image

The frontend Docker image has `NEXT_PUBLIC_*` vars baked in at build time. Anyone pulling the image from DockerHub gets the builder's Azure AD values and **cannot** change them at runtime. To use your own Azure AD tenant:

```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_AZURE_TENANT_ID="your-tenant-id" \
  --build-arg NEXT_PUBLIC_AZURE_CLIENT_ID="your-frontend-client-id" \
  --build-arg NEXT_PUBLIC_REDIRECT_URI="http://localhost:3000" \
  --build-arg NEXT_PUBLIC_BACKEND_SCOPE="api://your-backend-id/data.read" \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL="http://localhost:8080" \
  -t your-username/msal-demo-frontend:latest .
```

The backend image is universal — all config is runtime env vars.

---

## 5. Environment Variables

### Frontend — `frontend/.env.local`

```env
# ── BROWSER-SAFE (NEXT_PUBLIC_ prefix) — used by @azure/msal-browser ──────

# Tenant ID: controls which Azure AD tenant's users can sign in
NEXT_PUBLIC_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Frontend app registration client ID — identifies the app to Azure AD
NEXT_PUBLIC_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Post-login redirect URI — must match Redirect URI in Azure portal
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000

# Scope to request in user token — Spring Boot checks for SCOPE_data.read
NEXT_PUBLIC_BACKEND_SCOPE=api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/data.read

# Base URL of Spring Boot API
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080

# ── SERVER-ONLY (no NEXT_PUBLIC_) — used by @azure/msal-node ──────────────

# Server-side copy of tenant ID for MSAL Node authority URL
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Client ID of the app registration used for client credentials
# (can be the same frontend app reg — add a secret to it)
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Client secret — NEVER expose to browser, NEVER commit to git
AZURE_CLIENT_SECRET=your-client-secret-value

# Scope for app token — /.default grants all app roles assigned to this app
AZURE_APP_SCOPE=api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/.default
```

### Backend — environment / system properties

```env
# Azure AD — required in all environments
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_BACKEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000   # CORS allowed origin — no trailing slash

# Database — optional; omit all three to use H2 in-memory (local dev only)
SPRING_DATASOURCE_URL=jdbc:postgresql://host/dbname?sslmode=require
SPRING_DATASOURCE_USERNAME=db_user
SPRING_DATASOURCE_PASSWORD=db_password
```

When `SPRING_DATASOURCE_URL` is not set, Spring Boot falls back to H2 in-memory (configured in `application.yml`). Data is lost on every restart with H2. Set all three `SPRING_DATASOURCE_*` vars for Docker dev (points to the PostgreSQL container) or production (points to Neon).

---

## 6. Key Technical Decisions

### JWT validation in Spring Boot

`SecurityConfig.java` does three things:

1. **Issuer validation** — auto-discovered from `issuer-uri` in `application.yml`. Spring Boot fetches `https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration` on startup to get the JWKS URI and valid issuer string.

2. **Audience validation** — custom `AudienceValidator` checks the `aud` claim equals `AZURE_BACKEND_CLIENT_ID`. Prevents token replay attacks (a token minted for app A cannot be used against app B).

3. **Authority mapping** — custom `AzureJwtGrantedAuthoritiesConverter` reads both:
   - `scp` claim (user tokens) → `SCOPE_data.read`
   - `roles` claim (app tokens and user role assignments) → `ROLE_Admin`, `ROLE_User`

### Route authorization

```
/api/public/**         → .authenticated()            (any valid Azure AD JWT)
/api/dashboard/admin/**→ .hasAuthority("ROLE_Admin") (Admin role only)
/api/dashboard/**      → .hasAuthority("SCOPE_data.read") (any logged-in user)
```

App tokens cannot reach `/api/dashboard/**` because they have no `scp` claim, so `SCOPE_data.read` is never granted.

### Why `sessionStorage` for token cache

MSAL is configured with `cacheLocation: "sessionStorage"`. Tokens are cleared when the tab closes. Use `"localStorage"` if you need persistence across tabs, but understand the security trade-off (XSS can read localStorage).

### Server Component vs Client Component split

- `page.tsx` (home) — **Server Component**: fetches public data on the server, renders HTML with data already in it. Good for SEO and performance.
- `dashboard/page.tsx` — **Client Component** (`"use client"`): needs `useMsal()` hook which requires browser APIs. Guards the route client-side.
- `MsalProviderWrapper.tsx` — the `"use client"` boundary. Everything below it can be either server or client, but the MSAL context is only available to client components.

---

## 7. Database Layer

### Three environments, one codebase

| Environment | Database | How configured |
|---|---|---|
| Local dev (no Docker) | H2 in-memory | Default in `application.yml` — zero setup, data lost on restart |
| Docker dev | PostgreSQL 16 (Alpine container) | `SPRING_DATASOURCE_*` env vars set by `docker-compose.yml` |
| Production | Neon serverless PostgreSQL | `SPRING_DATASOURCE_*` env vars set in Render dashboard |

The switching logic is in `backend/src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:h2:mem:msaldb}        # H2 if env var absent
    username: ${SPRING_DATASOURCE_USERNAME:sa}
    password: ${SPRING_DATASOURCE_PASSWORD:}
    driver-class-name: ${SPRING_DATASOURCE_DRIVER:org.h2.Driver}
  jpa:
    hibernate:
      ddl-auto: ${JPA_DDL_AUTO:update}                      # Hibernate creates/updates schema
    database-platform: ${JPA_PLATFORM:org.hibernate.dialect.H2Dialect}
  sql:
    init:
      mode: ${SQL_INIT_MODE:always}                         # always run data.sql
```

### Schema management

Hibernate manages the schema automatically via `ddl-auto: update`. On startup it reads `DataItem.java` and creates or alters the `data_items` table to match. No migration tool (Flyway/Liquibase) is needed for this demo.

### JPA stack

| Layer | Class | Role |
|---|---|---|
| Entity | `entity/DataItem.java` | `@Entity` mapped to `data_items` table; fields: `id` (Long, auto), `title` (String), `description` (String) |
| Repository | `repository/DataItemRepository.java` | `extends JpaRepository<DataItem, Long>` — provides `findAll()`, `findById()`, save, delete with no SQL |
| Controller | `controller/PublicController.java` | Injects `DataItemRepository`, calls `findAll()` on `GET /api/public/data` |

### Seed data

`backend/src/main/resources/data.sql` runs on every startup. Uses `INSERT ... WHERE NOT EXISTS` so it is safe to run repeatedly — no duplicate rows accumulate across restarts.

```sql
INSERT INTO data_items (title, description)
SELECT 'Spring Boot', 'Java backend framework with embedded Tomcat and auto-configuration'
WHERE NOT EXISTS (SELECT 1 FROM data_items WHERE title = 'Spring Boot');
-- (repeated for Next.js, Azure MSAL, PostgreSQL, Docker)
```

### Neon (production database)

[Neon](https://neon.tech) is serverless PostgreSQL. Free tier provides:
- 0.5 GB storage
- Serverless branching (not used here)
- SSL required — add `?sslmode=require` to the JDBC URL

Connection string format:
```
jdbc:postgresql://ep-xyz.us-east-2.aws.neon.tech/neondb?user=neondb_owner&password=xxxxx&sslmode=require
```

Set this as `SPRING_DATASOURCE_URL` in Render. Extract username and password into `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD` separately.

### H2 console (local dev only)

The H2 web console is available at `http://localhost:8080/h2-console` when running without Docker. Use JDBC URL `jdbc:h2:mem:msaldb` to connect.

---

## 8. API Reference

### GET /api/public/data
- **Auth:** Any valid Azure AD JWT (app token or user token)
- **Response:**
```json
{
  "message": "string",
  "items": [{ "id": 1, "title": "string", "description": "string" }],
  "tokenType": "application (client credentials) | delegated (user)",
  "tokenSubject": "string (JWT sub claim)"
}
```

### GET /api/dashboard/data
- **Auth:** User JWT with `scp` containing `data.read`
- **Response:**
```json
{
  "user": {
    "name": "string",
    "email": "string",
    "objectId": "string",
    "roles": ["Admin"] 
  },
  "scopes": "data.read openid profile",
  "dashboard": [{ "metric": "string", "value": "string | number" }],
  "message": "string"
}
```

### GET /api/dashboard/admin
- **Auth:** User JWT with `ROLE_Admin` (user must be assigned Admin app role in Azure)
- **403** if user has `User` role
- **Response:**
```json
{
  "adminMessage": "string",
  "sensitiveData": [{ "user": "string", "role": "string", "lastLogin": "string" }],
  "systemHealth": { "database": "OK", "cache": "OK", "apiGateway": "OK" }
}
```

---

## 9. JWT Claim Cheat Sheet

| Claim | User Token | App Token |
|---|---|---|
| `scp` | `"data.read openid profile"` | absent |
| `roles` | `["Admin"]` or `["User"]` | absent (unless app role assigned) |
| `preferred_username` | user's UPN / email | absent |
| `name` | user's display name | absent |
| `oid` | user's object ID | service principal object ID |
| `appid` | frontend client ID | frontend client ID |
| `iss` | `https://login.microsoftonline.com/<tenant>/v2.0` | same |
| `aud` | backend client ID | backend client ID |

---

## 10. Running Locally

> Full interactive guide: `README.md` → Section 2. Full guide also in `LOCAL_RUN.md`.

### Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Java | 17 | `java -version` |
| Maven | 3.9 | `mvn -version` |
| Node.js | 20 | `node -version` |

Azure AD must be configured first (see `AZURE_SETUP.md`). You need: `AZURE_TENANT_ID`, `AZURE_BACKEND_CLIENT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.

### Step-by-step

**Step 1 — Check prerequisites** (all three must return a version)
```bash
java -version && mvn -version && node -version
```

**Step 2 — Clone the repo**
```bash
git clone https://github.com/<your-username>/azure-msal-nextjs-springboot-demo.git
cd azure-msal-nextjs-springboot-demo
```

**Step 3 — Start Spring Boot backend (Terminal 1)**

Linux/macOS:
```bash
cd backend
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_BACKEND_CLIENT_ID="your-backend-client-id"
export FRONTEND_URL="http://localhost:3000"
mvn spring-boot:run
```

Windows (PowerShell):
```powershell
cd backend
$env:AZURE_TENANT_ID         = "your-tenant-id"
$env:AZURE_BACKEND_CLIENT_ID = "your-backend-client-id"
$env:FRONTEND_URL            = "http://localhost:3000"
mvn spring-boot:run
```

Wait for: `Started MsalDemoApplication in X.XXX seconds`

**Step 4 — Verify backend health (Terminal 2)**
```bash
curl http://localhost:8080/actuator/health
# Expected: {"status":"UP"}
```

**Step 5 — Configure frontend (Terminal 2)**
```bash
cd frontend
cp .env.local.example .env.local       # Linux/macOS
# Windows: copy .env.local.example .env.local
```

Edit `.env.local` — fill in all 9 values (see Section 5 for the full list).

**Step 6 — Install and start frontend (Terminal 2)**
```bash
npm install
npm run dev
# Wait for: ✓ Ready in X.Xs
```

**Step 7 — Smoke test** — open `http://localhost:3000`:
- Public page shows items fetched with the **application token** (no login needed) ✓
- Click **Sign in** → Admin user → Dashboard + **Admin Panel** visible ✓
- Sign out → regular User → Dashboard only, no Admin Panel ✓

### Common errors

| Error | Fix |
|---|---|
| Backend fails to start | Check `AZURE_TENANT_ID` and `AZURE_BACKEND_CLIENT_ID` values — no quotes or spaces |
| Public page "Could not load data" | Backend is not on port 8080, or not yet started |
| `AADSTS50011` on login | Add `http://localhost:3000` to msal-demo-frontend → Authentication → redirect URIs |
| Dashboard empty / 403 | `NEXT_PUBLIC_BACKEND_SCOPE` must be `api://<BACKEND_CLIENT_ID>/data.read` exactly |
| Admin Panel missing | User not assigned Admin role in Enterprise apps → msal-demo-backend → Users and groups |

---

## 11. Deployment Guide — Free Hosting

### Recommended stack (fully free)

| Service | Provider | Free limits |
|---|---|---|
| Next.js frontend | **Vercel** Hobby | 100 GB bandwidth/month, serverless functions, edge network |
| Spring Boot backend | **Render** Free | 512 MB RAM, sleeps after 15 min of inactivity |
| PostgreSQL database | **Neon** Free | 0.5 GB storage, serverless, SSL required |
| Auth | **Microsoft Entra ID Free** | Unlimited auth flows, users, app roles |

### Step-by-step: Set up Neon (database)

1. Sign up at [neon.tech](https://neon.tech) — free, no credit card
2. Create a project named `msal-demo` in the same region as your Render backend
3. On the dashboard, click **Connection string** → select **JDBC** format
4. Copy the string, which looks like:
   ```
   jdbc:postgresql://ep-xyz.us-east-2.aws.neon.tech/neondb?user=neondb_owner&password=xxxxx&sslmode=require
   ```
5. Set these as env vars in Render:
   - `SPRING_DATASOURCE_URL` = the full JDBC string above
   - `SPRING_DATASOURCE_USERNAME` = the `user` value from the string
   - `SPRING_DATASOURCE_PASSWORD` = the `password` value from the string

### Caveats

**Render free tier sleeps** — after 15 minutes of no traffic the instance spins down. First request after sleep takes 30–60 seconds (JVM cold start + Render wake-up). Acceptable for demos; not for production. Workaround: use [UptimeRobot](https://uptimerobot.com) (free) to ping the backend every 14 minutes.

**Render JVM memory** — 512 MB is tight. Add these JVM flags to avoid OOM:
```
JAVA_TOOL_OPTIONS=-Xmx256m -Xss512k -XX:+UseSerialGC
```

### Step-by-step: Deploy Spring Boot to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo, select the `backend/` folder
4. Build command: `mvn clean package -DskipTests`
5. Start command: `java $JAVA_TOOL_OPTIONS -jar target/msal-demo-0.0.1-SNAPSHOT.jar`
6. Add environment variables:
   - `AZURE_TENANT_ID`
   - `AZURE_BACKEND_CLIENT_ID`
   - `FRONTEND_URL` ← set to your Vercel URL (once known)
   - `SPRING_DATASOURCE_URL` ← from Neon (see above)
   - `SPRING_DATASOURCE_USERNAME` ← from Neon
   - `SPRING_DATASOURCE_PASSWORD` ← from Neon
   - `JPA_DDL_AUTO=update` ← Hibernate auto-creates tables on first run
   - `SQL_INIT_MODE=always` ← ensures `data.sql` seed runs
   - `JAVA_TOOL_OPTIONS=-Xmx256m -Xms64m` ← keeps JVM within 512 MB free limit
7. Deploy — Render gives you a URL like `https://msal-demo-xxxx.onrender.com`
8. On first deploy, Hibernate creates the `data_items` table and `data.sql` seeds 5 rows — verify via `/api/public/data`

### Step-by-step: Deploy Next.js to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add all environment variables from `.env.local` in Vercel's dashboard
   - Change `NEXT_PUBLIC_REDIRECT_URI` to your Vercel URL
   - Change `NEXT_PUBLIC_BACKEND_API_URL` to your Render URL
4. Deploy — Vercel gives you a URL like `https://msal-demo.vercel.app`

### Azure AD changes for production

After deploying, go back to the **frontend app registration** in Azure Portal:
- **Authentication → Add URI**: add your Vercel URL (e.g., `https://msal-demo.vercel.app`)
- This is required — Azure AD will reject logins that redirect to an unregistered URI

Also update `FRONTEND_URL` in Render environment variables to match your Vercel URL for CORS.

### Alternative backend: Oracle Cloud Always Free

If Render's sleep behaviour is a problem, Oracle Cloud offers 2 always-on AMD VMs (1 OCPU, 1 GB RAM) — no sleep, no expiry. Requires:
- Create a free Oracle Cloud account
- Provision a VM, install Java 17
- Run the Spring Boot JAR as a systemd service
- Open port 8080 in OCI security rules

More complex to set up but the backend runs 24/7 for free.

---

## 12. What's Done / What's Next

### Done ✅
- [x] Next.js 14 frontend with MSAL Browser (user login popup, logout)
- [x] Application token flow (Next.js server → Azure AD → Spring Boot, client credentials)
- [x] Spring Boot JWT validation (issuer, audience, signature — custom AudienceValidator)
- [x] Two app roles: Admin and User (AzureJwtGrantedAuthoritiesConverter)
- [x] Admin-only endpoint (`/api/dashboard/admin`) with role check
- [x] CORS configuration
- [x] Role-based UI (admin panel only visible to Admin role users)
- [x] PostgreSQL / H2 / Neon database support (JPA, DataItem entity, seed data)
- [x] Docker multi-stage builds (backend + frontend)
- [x] Docker Compose dev (with PostgreSQL) and prod (DockerHub + Neon)
- [x] Render Blueprint (`render.yaml`) for backend auto-deploy
- [x] Vercel config (`vercel.json`) for frontend auto-deploy
- [x] Full test suite: JUnit 5 (backend), Jest + MSW (frontend), Playwright E2E
- [x] Complete documentation: AZURE_SETUP.md, DEPLOYMENT.md, DOCKER.md, README.md
- [x] CLAUDE.md and CONTEXT.md for AI model / developer handoff

### Remaining Steps (user action required) 🔲
- [ ] Follow `AZURE_SETUP.md` to create app registrations, scopes, roles, and test users
- [ ] Fill in Azure AD values in `.env.local` (local dev) or `.env.dev` (Docker)
- [ ] Run locally and test both token flows end-to-end
- [ ] Push images to DockerHub (see `DEPLOYMENT.md`)
- [ ] Deploy to Vercel + Render + Neon (see `DEPLOYMENT.md`)
- [ ] Add Vercel production URL to Azure portal redirect URIs
- [ ] Optional: Add Microsoft Graph API call to fetch user photo
- [ ] Optional: Add token expiry / refresh countdown in dashboard

---

## 13. Dependencies

### Frontend (`frontend/package.json`)

| Package | Version | Purpose |
|---|---|---|
| `next` | 14.2.3 | React framework (App Router) |
| `@azure/msal-browser` | ^3.13.0 | Browser-side MSAL (user login) |
| `@azure/msal-react` | ^2.0.22 | React hooks/components for MSAL |
| `@azure/msal-node` | ^2.9.2 | Server-side MSAL (app token) |
| `tailwindcss` | ^3 | Styling |

### Backend (`backend/pom.xml`)

| Artifact | Purpose |
|---|---|
| `spring-boot-starter-web` | REST API |
| `spring-boot-starter-security` | Security filter chain |
| `spring-boot-starter-oauth2-resource-server` | JWT validation, Bearer token support |
| `spring-boot-starter-data-jpa` | JPA / Hibernate ORM — entity mapping + repository |
| `spring-boot-starter-actuator` | `/actuator/health` endpoint for Render health check |
| `postgresql` | PostgreSQL JDBC driver (runtime) |
| `h2` | H2 in-memory database (test + local dev fallback) |
| `lombok` | Boilerplate reduction |

---

## 14. Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `AADSTS50011: Redirect URI mismatch` | Azure portal Redirect URI doesn't match `NEXT_PUBLIC_REDIRECT_URI` | Add the exact URI in Azure portal → Authentication |
| `401 Unauthorized` from Spring Boot | Token audience doesn't match `AZURE_BACKEND_CLIENT_ID` | Verify backend client ID in `application.yml` and token request |
| `403 Forbidden` on `/api/dashboard/admin` | User doesn't have Admin app role assigned | Assign Admin role in Enterprise applications → Users and groups |
| `invalid_client` from Azure AD | Wrong `AZURE_CLIENT_SECRET` | Regenerate secret in Azure portal → Certificates & secrets |
| Spring Boot OOM on Render | 512 MB exceeded by JVM | Add `JAVA_TOOL_OPTIONS=-Xmx256m -XX:+UseSerialGC` env var in Render |
| `scp` claim missing in token | Using app token on a user endpoint | Make sure browser MSAL is configured with the `data.read` scope in `loginRequest` |
| `Connection refused` to PostgreSQL | `SPRING_DATASOURCE_URL` not set or wrong host | Verify env var is set; in Docker the host is `db` not `localhost` |
| `SSL connection required` (Neon) | Neon requires SSL, URL missing `?sslmode=require` | Append `?sslmode=require` to the JDBC connection string |
| Empty `items` list on public page | `data.sql` did not run | Ensure `spring.sql.init.mode=always` in `application.yml` (or set `SQL_INIT_MODE=always` env var) |
| Duplicate rows in DB after restart | Old `data.sql` without `WHERE NOT EXISTS` | Current `data.sql` is idempotent — if you see duplicates, a prior version ran; truncate the table once |
| H2 console not accessible | Running in Docker/PostgreSQL mode | H2 console only works when H2 datasource is active (no `SPRING_DATASOURCE_URL` set); connect via `http://localhost:8080/h2-console` in local dev only |
