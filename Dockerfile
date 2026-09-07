# syntax=docker/dockerfile:1

# ── 1. Dependencies ──────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. Build ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time —
# Next.js can't pick them up from the container's runtime environment, so
# they must be passed as --build-arg. SUPABASE_SERVICE_ROLE_KEY is
# deliberately NOT here: it's server-only and stays a runtime-only secret
# (see docker-compose.yml / the `docker run -e` examples in the README).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL=$NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── 3. Runtime ───────────────────────────────────────────────────────────────
# `output: "standalone"` (next.config.mjs) traces a minimal server bundle
# with only the dependencies actually used at runtime, so this final stage
# never needs the full node_modules — keeps the shipped image small.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
