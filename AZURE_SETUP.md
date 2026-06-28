# Azure AD Setup Guide

> **This is the only manual step in the entire project.**
> Everything else — code, Docker, deployment — is automated.
> Follow this guide once per environment (local, production).

---

## What You Will Create

| Item | Name | Purpose |
|---|---|---|
| App registration | `msal-demo-backend` | Represents Spring Boot. Defines the `data.read` scope and `Admin`/`User` app roles. |
| App registration | `msal-demo-frontend` | Used by the browser (MSAL.js login) and Next.js server (app token). |
| Test user | `admin@<tenant>` | Assigned the **Admin** role — can access `/api/dashboard/admin` |
| Test user | `user@<tenant>` | Assigned the **User** role — can access `/api/dashboard/data` only |

Both app registrations belong to the **same Azure AD tenant**. Everything runs on the **free tier** (Entra ID Free).

---

## Prerequisites

- A Microsoft account (personal, work, or school) — free to create at [account.microsoft.com](https://account.microsoft.com)
- Access to [portal.azure.com](https://portal.azure.com)
- If you are using a personal Microsoft account, you automatically get a free Azure AD tenant

---

## Before You Start — Find Your Tenant ID

1. Go to [portal.azure.com](https://portal.azure.com)
2. Search for **"Microsoft Entra ID"** (formerly Azure Active Directory)
3. On the Overview page, copy the **Tenant ID** (a UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
4. Save it — you will use it everywhere as `AZURE_TENANT_ID`

---

## Step 1 — Register the Backend API App

This app registration represents your Spring Boot service. It defines what scopes and roles exist.

### 1.1 Create the registration

1. In Entra ID → **App registrations → New registration**
2. Fill in:
   - **Name**: `msal-demo-backend`
   - **Supported account types**: **Accounts in this organizational directory only** (Single tenant)
   - **Redirect URI**: leave blank — APIs don't redirect
3. Click **Register**
4. On the Overview page, copy:
   - **Application (client) ID** → save as `AZURE_BACKEND_CLIENT_ID`
   - **Directory (tenant) ID** → confirms your `AZURE_TENANT_ID`

### 1.2 Expose an API — create the `data.read` scope

This scope is what the browser requests when a user logs in. Spring Boot checks for `SCOPE_data.read` on protected endpoints.

1. In the backend app registration → **Expose an API**
2. Next to **Application ID URI**, click **Add** → accept the default `api://<BACKEND_CLIENT_ID>` → **Save**
3. Click **Add a scope**:

| Field | Value |
|---|---|
| Scope name | `data.read` |
| Who can consent | **Admins and users** |
| Admin consent display name | `Read API data` |
| Admin consent description | `Allows the app to read data from the API` |
| User consent display name | `Read API data` |
| User consent description | `Allows the app to read data from the API on your behalf` |
| State | **Enabled** |

4. Click **Add scope**

The full scope URI is now: `api://<BACKEND_CLIENT_ID>/data.read`

This goes into your env file as:
```
NEXT_PUBLIC_BACKEND_SCOPE=api://<BACKEND_CLIENT_ID>/data.read
```

### 1.3 Define App Roles — Admin and User

App roles appear in the `roles` claim of the user's JWT when they log in. Spring Boot maps them to `ROLE_Admin` and `ROLE_User`.

1. Still in the backend app registration → **App roles → Create app role**

**Create the Admin role:**

| Field | Value |
|---|---|
| Display name | `Admin` |
| Allowed member types | **Users/Groups** |
| Value | `Admin` |
| Description | `Full access including admin-only endpoints` |
| Do you want to enable this app role? | ✅ Checked |

Click **Apply**.

**Create the User role:**

| Field | Value |
|---|---|
| Display name | `User` |
| Allowed member types | **Users/Groups** |
| Value | `User` |
| Description | `Standard user access to dashboard data` |
| Do you want to enable this app role? | ✅ Checked |

Click **Apply**.

> **Important:** The `Value` field (`Admin` and `User`) is what appears in the JWT `roles` claim. Spring Boot's `AzureJwtGrantedAuthoritiesConverter` maps these to `ROLE_Admin` and `ROLE_User`. The values must match exactly.

---

## Step 2 — Register the Frontend App

This app registration is used in two ways:
- By the **browser** (MSAL.js / `@azure/msal-browser`) for the user login popup
- By the **Next.js server** (MSAL Node / `@azure/msal-node`) for the machine-to-machine app token

### 2.1 Create the registration

1. **App registrations → New registration**
2. Fill in:
   - **Name**: `msal-demo-frontend`
   - **Supported account types**: **Single tenant**
   - **Redirect URI**:
     - Platform: **Single-page application (SPA)**
     - URI: `http://localhost:3000`
3. Click **Register**
4. Copy the **Application (client) ID** → save as `AZURE_CLIENT_ID` and `NEXT_PUBLIC_AZURE_CLIENT_ID`

> Using **SPA** platform type is required — it enables the Authorization Code flow with PKCE, which `@azure/msal-browser` uses. Without it, the login popup will fail.

### 2.2 Add redirect URIs for all environments

You can add multiple redirect URIs to the same app registration. Add all the environments you use now — you can always add more later.

1. Frontend app registration → **Authentication**
2. Under **Single-page application**, click **Add URI** for each environment:

| Environment | URI |
|---|---|
| Local dev | `http://localhost:3000` (already added) |
| Docker local | `http://localhost:3000` (same) |
| Vercel production | `https://your-app.vercel.app` (add after deploy) |

3. Under **Advanced settings**:
   - **Logout URL**: `http://localhost:3000` (for local; update after prod deploy)
4. Click **Save**

### 2.3 Create a client secret (for server-side app tokens)

The Next.js server needs this to obtain application tokens via MSAL Node.

1. Frontend app registration → **Certificates & secrets → New client secret**
2. Fill in:
   - **Description**: `nextjs-server-secret`
   - **Expires**: 24 months (max on free tier)
3. Click **Add**
4. **Copy the `Value` field immediately** — Azure hides it after you leave this page
   - Save as `AZURE_CLIENT_SECRET`

> ⚠️ Never commit this value to git. Never put it in a `NEXT_PUBLIC_` variable. Never include it in a Docker image. Always pass it as a runtime environment variable.

### 2.4 Grant API permissions

The frontend app needs permission to call the backend API and Microsoft Graph.

1. Frontend app registration → **API permissions → Add a permission**

**Add Microsoft Graph delegated permissions:**
- Click **Microsoft Graph → Delegated permissions**
- Search and add: `openid`, `profile`, `email`, `User.Read`
- Click **Add permissions**

**Add the backend API permission:**
- Click **Add a permission → My APIs → msal-demo-backend**
- Select **Delegated permissions → data.read**
- Click **Add permissions**

2. Click **Grant admin consent for [your tenant name]** → **Yes**

Without admin consent, users will be shown a consent screen on every login. Granting it once removes that screen.

### 2.5 Assign the DataReader role for app tokens (optional)

If you want the application token (Next.js server → Spring Boot) to carry a role claim, assign the frontend's service principal to a role on the backend.

However, for this project **the public endpoint only requires `.authenticated()`** — any valid Azure AD JWT passes, regardless of roles. So this step is optional.

If you want the app token to carry `roles: ["DataReader"]`, do this:

1. Go to **Microsoft Entra ID → Enterprise applications → msal-demo-backend**
2. **Users and groups → Add user/group**
3. Under **Users and groups**, search for `msal-demo-frontend` (the service principal)
4. Under **Select a role**, choose `Admin` (or create a separate `DataReader` role for apps)
5. Click **Assign**

---

## Step 3 — Create Test Users

You need at least two users to test the role-based access control.

### Option A — Create users in your Azure AD tenant (recommended)

1. **Microsoft Entra ID → Users → New user → Create new user**

**Create the Admin user:**

| Field | Value |
|---|---|
| User principal name | `admin@<your-tenant-domain>.onmicrosoft.com` |
| Display name | `Admin User` |
| Password | Set a temporary password — user must change on first login |

**Create the regular user:**

| Field | Value |
|---|---|
| User principal name | `user@<your-tenant-domain>.onmicrosoft.com` |
| Display name | `Regular User` |
| Password | Set a temporary password |

> Your tenant domain looks like `contoso.onmicrosoft.com`. Find it in Entra ID → Overview → Primary domain.

### Option B — Use existing Microsoft accounts (guest users)

You can invite external users (e.g., your personal Microsoft account) as guests:

1. **Entra ID → Users → New user → Invite external user**
2. Enter their email address → **Invite**
3. They accept the invitation and can now be assigned roles

### 3.1 Assign App Roles to users

This is the step that puts `"roles": ["Admin"]` or `"roles": ["User"]` into the user's JWT.

1. **Microsoft Entra ID → Enterprise applications**
2. Search for **msal-demo-backend** → click it
3. **Users and groups → Add user/group**

**Assign Admin role:**
- Users and groups: select `Admin User`
- Select a role: **Admin**
- Click **Assign**

**Assign User role:**
- Users and groups: select `Regular User`
- Select a role: **User**
- Click **Assign**

> If you don't see role options, it means the app roles haven't been created yet. Go back to Step 1.3.

> If you only see one role option ("Default Access"), the app registration's app roles are not yet configured. Go back to Step 1.3 and create both roles.

---

## Step 4 — Collect All Values

After completing Steps 1–3, you have all the values you need. Fill in this table:

| Value | Where to find it | Env var name |
|---|---|---|
| Tenant ID | Entra ID → Overview → Tenant ID | `AZURE_TENANT_ID` |
| Backend client ID | `msal-demo-backend` → Overview → Application (client) ID | `AZURE_BACKEND_CLIENT_ID` |
| Frontend client ID | `msal-demo-frontend` → Overview → Application (client) ID | `AZURE_CLIENT_ID` / `NEXT_PUBLIC_AZURE_CLIENT_ID` |
| Frontend client secret | `msal-demo-frontend` → Certificates & secrets → Value (copied at creation) | `AZURE_CLIENT_SECRET` |
| Backend scope (user login) | `api://<BACKEND_CLIENT_ID>/data.read` | `NEXT_PUBLIC_BACKEND_SCOPE` |
| App scope (machine token) | `api://<BACKEND_CLIENT_ID>/.default` | `AZURE_APP_SCOPE` |

---

## Step 5 — Configure Environment Variables

### Local development (no Docker)

Copy and fill in `frontend/.env.local.example` → `frontend/.env.local`:

```env
# ── Browser (baked into Next.js build) ──────────────────────────────────────
NEXT_PUBLIC_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_BACKEND_SCOPE=api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/data.read
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080

# ── Server-side only (never exposed to browser) ──────────────────────────────
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-client-secret-value
AZURE_APP_SCOPE=api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/.default
```

Set Spring Boot env vars before running:

**Windows (PowerShell):**
```powershell
$env:AZURE_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
$env:AZURE_BACKEND_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
$env:FRONTEND_URL="http://localhost:3000"
mvn spring-boot:run
```

**Linux / macOS (bash):**
```bash
export AZURE_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export AZURE_BACKEND_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export FRONTEND_URL="http://localhost:3000"
mvn spring-boot:run
```

### Docker Compose (local dev with PostgreSQL)

Copy `.env.dev.example` → `.env.dev` and fill in the Azure section:

```env
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-client-secret-value
AZURE_APP_SCOPE=api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/.default
AZURE_BACKEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

NEXT_PUBLIC_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
NEXT_PUBLIC_BACKEND_SCOPE=api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/data.read
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080

FRONTEND_URL=http://localhost:3000
BACKEND_INTERNAL_URL=http://backend:8080
```

Then run:
```bash
docker compose --env-file .env.dev up --build
```

> ⚠️ **NEXT_PUBLIC_ vars are baked into the Docker image at build time.** If you change `NEXT_PUBLIC_AZURE_TENANT_ID` after building, you must rebuild with `--build`.

### Running DockerHub images locally

When pulling the pre-built image from DockerHub, the **frontend image already has `NEXT_PUBLIC_*` values baked in** from when it was built. These cannot be changed at runtime.

- The **backend image** works with any Azure AD tenant — all config is runtime env vars.
- The **frontend image** was built with specific Azure AD values. To use your own Azure AD tenant, you must build your own frontend image (see DEPLOYMENT.md → Section 3).

To run with someone else's frontend image (using their Azure AD tenant):
```bash
cp .env.prod.example .env.prod
# Fill in only the server-side vars (AZURE_CLIENT_SECRET, SPRING_DATASOURCE_*, etc.)
# The NEXT_PUBLIC_ values in the image are fixed from build time
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

To run with your own Azure AD tenant:
```bash
# 1. Build your own frontend image with your Azure values
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_AZURE_TENANT_ID="your-tenant-id" \
  --build-arg NEXT_PUBLIC_AZURE_CLIENT_ID="your-frontend-client-id" \
  --build-arg NEXT_PUBLIC_REDIRECT_URI="http://localhost:3000" \
  --build-arg NEXT_PUBLIC_BACKEND_SCOPE="api://your-backend-id/data.read" \
  --build-arg NEXT_PUBLIC_BACKEND_API_URL="http://localhost:8080" \
  -t your-dockerhub-username/msal-demo-frontend:latest .

# 2. Update docker-compose.prod.yml to use your image, or use docker-compose.yml to build from source
```

### Production (Vercel + Render)

**Vercel (frontend):**

Add these in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Your tenant ID |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Frontend client ID |
| `NEXT_PUBLIC_REDIRECT_URI` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_BACKEND_SCOPE` | `api://<backend-id>/data.read` |
| `NEXT_PUBLIC_BACKEND_API_URL` | `https://your-backend.onrender.com` |
| `AZURE_TENANT_ID` | Your tenant ID |
| `AZURE_CLIENT_ID` | Frontend client ID |
| `AZURE_CLIENT_SECRET` | Your client secret |
| `AZURE_APP_SCOPE` | `api://<backend-id>/.default` |
| `BACKEND_INTERNAL_URL` | `https://your-backend.onrender.com` |

**Render (backend):**

Add these in Render dashboard → your service → Environment:

| Variable | Value |
|---|---|
| `AZURE_TENANT_ID` | Your tenant ID |
| `AZURE_BACKEND_CLIENT_ID` | Backend client ID |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `SPRING_DATASOURCE_URL` | Neon JDBC connection string |
| `SPRING_DATASOURCE_USERNAME` | Neon username |
| `SPRING_DATASOURCE_PASSWORD` | Neon password |
| `JAVA_TOOL_OPTIONS` | `-Xmx256m -Xms64m` |

---

## Step 6 — Add Production Redirect URIs

After deploying to Vercel, you must register the production URL in Azure portal or login will fail with `AADSTS50011: Redirect URI mismatch`.

1. **Azure Portal → App registrations → msal-demo-frontend → Authentication**
2. Under **Single-page application**, click **Add URI**
3. Add: `https://your-app.vercel.app`
4. Also update the **Logout URL** to `https://your-app.vercel.app`
5. Click **Save**

Do this whenever your production URL changes (e.g., after a Vercel project rename).

---

## Step 7 — Verify Everything Works

### Test 1: Public page (app token)

```bash
# Start both backend and frontend, then:
curl http://localhost:3000
# OR open http://localhost:3000 in browser

# You should see the public data list (Spring Boot data fetched with app token)
# If you see "Could not load data", check backend is running and app token is working
```

**Backend logs should show:**
```
JWT validated: aud=<BACKEND_CLIENT_ID>, iss=https://login.microsoftonline.com/<tenant>/v2.0
```

### Test 2: User login (user token)

1. Open `http://localhost:3000`
2. Click **Sign in with Microsoft**
3. Log in as `admin@<tenant>` or `user@<tenant>`
4. You should be redirected to `/dashboard`
5. The dashboard shows your name, email, and role

### Test 3: Role-based access

- Log in as the **Admin** user → you should see the **Admin Panel** section on the dashboard
- Log in as the **User** user → no Admin Panel (the `ROLE_Admin` check returns 403)

### Test 4: Verify token claims

You can decode any JWT at [jwt.ms](https://jwt.ms) to inspect its claims. After logging in:
- The **user token** should have `"scp": "data.read openid profile"` and `"roles": ["Admin"]` or `["User"]`
- The **app token** (from Next.js server) should have no `scp` but may have `"roles": ["DataReader"]` if you completed the optional Step 2.5

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `AADSTS50011: Redirect URI mismatch` | The `NEXT_PUBLIC_REDIRECT_URI` doesn't match any URI registered in Azure portal | Add the exact URI in Azure portal → Authentication → SPA redirect URIs |
| `401 Unauthorized` from Spring Boot | JWT audience doesn't match `AZURE_BACKEND_CLIENT_ID` | Check `AZURE_BACKEND_CLIENT_ID` matches the backend app registration's client ID |
| `403 Forbidden` on `/api/dashboard/admin` | User doesn't have Admin role assigned | In Enterprise applications → msal-demo-backend → Users and groups, assign Admin role |
| `invalid_client` error from Azure AD | Wrong `AZURE_CLIENT_SECRET` | Regenerate in Azure portal → Certificates & secrets; update the value everywhere |
| `scp` claim missing from user token | Wrong scope in `loginRequest` | Check `NEXT_PUBLIC_BACKEND_SCOPE` is set to `api://<BACKEND_CLIENT_ID>/data.read` |
| `roles` claim missing from user token | Role not assigned to user in Enterprise applications | Go to Step 3.1 and assign the Admin or User role to the test user |
| `AADSTS65001: No consent granted` | Admin consent not granted for the `data.read` permission | API permissions → Grant admin consent for [tenant] |
| App token fails / 401 | `AZURE_APP_SCOPE` is wrong | Must end in `/.default`: `api://<BACKEND_CLIENT_ID>/.default` |
| Login popup blocked | Browser is blocking popups | Allow popups for localhost in browser settings, or use `loginRedirect` instead |
| "Audience does not match" from Spring Boot | `AZURE_BACKEND_CLIENT_ID` is wrong | Must be the backend app's client ID, not the frontend's |
| `NEXT_PUBLIC_` not reflecting new values | Vars baked at build time | Rebuild the Next.js app: `npm run build` or rebuild Docker image |

---

## Environment Variable Quick Reference

| Variable | Side | Description | Example |
|---|---|---|---|
| `AZURE_TENANT_ID` | Backend + Frontend server | Your Azure AD tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_BACKEND_CLIENT_ID` | Backend only | Backend app registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_ID` | Frontend server | Frontend app registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_SECRET` | Frontend server | Client secret for app token | `abc123~xyz` |
| `AZURE_APP_SCOPE` | Frontend server | Scope for app token request | `api://<id>/.default` |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Frontend browser | Same tenant ID, browser-visible | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Frontend browser | Same frontend client ID, browser-visible | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `NEXT_PUBLIC_REDIRECT_URI` | Frontend browser | Post-login redirect URL | `http://localhost:3000` |
| `NEXT_PUBLIC_BACKEND_SCOPE` | Frontend browser | Scope requested for user token | `api://<id>/data.read` |
| `NEXT_PUBLIC_BACKEND_API_URL` | Frontend browser | Spring Boot public URL | `http://localhost:8080` |
| `FRONTEND_URL` | Backend only | CORS allowed origin | `http://localhost:3000` |
| `BACKEND_INTERNAL_URL` | Frontend server | Docker-internal Spring Boot URL | `http://backend:8080` |

---

## How the Same Azure AD Config Works Across Environments

The same two app registrations work for all environments because:

1. **Redirect URIs** are additive — you can have `http://localhost:3000` AND `https://your-app.vercel.app` registered at the same time. Azure uses whichever one matches the request.

2. **Client secrets** are the same for all environments — you just set the `AZURE_CLIENT_SECRET` env var in each environment (local `.env.local`, Docker `.env.dev`, Render dashboard, etc.).

3. **`NEXT_PUBLIC_*` vars** change per environment (because they point to different URLs), but they come from the same app registration's client ID and tenant ID.

4. **DockerHub images** — the backend image is universal. The frontend image is environment-specific because `NEXT_PUBLIC_*` vars are baked in. For the public DockerHub repo, users must build their own frontend image with their own tenant/client IDs.

```
Local dev:
  NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000        ← registered in Azure
  NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080

Docker local:
  NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000        ← same as above (same port)
  NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8080

Vercel production:
  NEXT_PUBLIC_REDIRECT_URI=https://your-app.vercel.app  ← add to Azure portal
  NEXT_PUBLIC_BACKEND_API_URL=https://your-backend.onrender.com
```

One Azure tenant, one pair of app registrations, many environments — just different redirect URIs and backend URLs.
