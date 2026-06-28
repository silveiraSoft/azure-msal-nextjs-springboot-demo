# ─────────────────────────────────────────────────────────────────────────────
# ⚠️  NEXT_PUBLIC_ VARIABLES AND DOCKER — READ THIS FIRST
#
# Next.js bakes NEXT_PUBLIC_ variables into the JavaScript bundle at BUILD time
# using webpack's DefinePlugin. They are NOT environment variables at runtime —
# they become string literals in the compiled JS files.
#
# This means:
#   ✅  Server-only vars (AZURE_CLIENT_SECRET, BACKEND_INTERNAL_URL, etc.)
#       can be injected at `docker run` time — they are read by Node.js.
#   ❌  NEXT_PUBLIC_ vars MUST be provided as Docker build --build-arg
#       because Next.js reads them during `npm run build`.
#
# Consequence for image sharing:
#   The backend image is universal — one image, any environment.
#   The frontend image is environment-specific — each environment (dev/prod)
#   needs its own build because the Azure AD client ID and URLs are baked in.
#   Each developer or team builds the frontend image for their own tenant.
# ─────────────────────────────────────────────────────────────────────────────

# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
# `npm ci` installs exactly what package-lock.json specifies (reproducible builds)
RUN npm ci --prefer-offline

# ─── Stage 2: Build Next.js ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ── Build-time arguments (NEXT_PUBLIC_ vars must be declared as ARG) ─────────
# These are passed from docker-compose `build.args` or `docker build --build-arg`.
# They are read by Next.js webpack at build time and compiled into the JS bundle.
ARG NEXT_PUBLIC_AZURE_TENANT_ID
ARG NEXT_PUBLIC_AZURE_CLIENT_ID
ARG NEXT_PUBLIC_REDIRECT_URI
ARG NEXT_PUBLIC_BACKEND_SCOPE
ARG NEXT_PUBLIC_BACKEND_API_URL

# Promote ARGs to ENVs so `next build` can see them
ENV NEXT_PUBLIC_AZURE_TENANT_ID=$NEXT_PUBLIC_AZURE_TENANT_ID
ENV NEXT_PUBLIC_AZURE_CLIENT_ID=$NEXT_PUBLIC_AZURE_CLIENT_ID
ENV NEXT_PUBLIC_REDIRECT_URI=$NEXT_PUBLIC_REDIRECT_URI
ENV NEXT_PUBLIC_BACKEND_SCOPE=$NEXT_PUBLIC_BACKEND_SCOPE
ENV NEXT_PUBLIC_BACKEND_API_URL=$NEXT_PUBLIC_BACKEND_API_URL

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build
# Output: .next/standalone/ — a self-contained Node.js server (~30 MB)

# ─── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone server output from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

USER nextjs

# ── Runtime environment variables (server-side only, injected at `docker run`)
# These are NOT baked into the image and can differ per environment:
#
#   AZURE_TENANT_ID        — tenant for MSAL Node (server-side)
#   AZURE_CLIENT_ID        — client ID for client credentials (server-side)
#   AZURE_CLIENT_SECRET    — client secret — NEVER bake into image
#   AZURE_APP_SCOPE        — scope for app token (server-side)
#   BACKEND_INTERNAL_URL   — Docker-internal URL for server→backend calls
#                            e.g. http://backend:8080
#                            (different from NEXT_PUBLIC_BACKEND_API_URL
#                             which the browser uses)
#   PORT                   — (optional) override listen port

ENV PORT=3000
EXPOSE 3000

# next.config.ts `output: "standalone"` generates this server.js entry point
CMD ["node", "server.js"]
