# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────
# Stage 1 – install workspace dependencies
# ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy only the files pnpm needs to resolve the workspace before source code
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────
# Stage 2 – build the Next.js app
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9 --activate

# Bring installed node_modules from deps stage
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules

# Copy source
COPY . .

# NEXT_PUBLIC_ vars are embedded into the JS bundle at build time.
# Pass them via --build-arg when running `docker build`.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm --filter web build

# ─────────────────────────────────────────────
# Stage 3 – lean production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output contains its own minimised node_modules
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./

# Static assets and public dir must be copied separately
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public       ./apps/web/public

USER nextjs

EXPOSE 3000

# Server-side secrets (SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY)
# are injected at runtime via env vars — never baked into the image.
CMD ["node", "apps/web/server.js"]
