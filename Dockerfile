FROM node:22-alpine AS base

# better-sqlite3 needs build tools
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# native module (better-sqlite3) must come from builder
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# DB 저장 폴더
RUN mkdir -p /data && chown nextjs:nodejs /data
ENV DB_PATH=/data/kiosk.db

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
