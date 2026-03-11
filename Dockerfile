# ============================================================================
# Multi-stage Dockerfile for SN AI Dev Agent
# Works on: Railway, Render, DigitalOcean App Platform, any Docker host
# ============================================================================

# ── Stage 1: Build mcp-servicenow ──────────────────────────────────────────
FROM node:20-alpine AS mcp-build

WORKDIR /app/mcp-servicenow
COPY mcp-servicenow/package.json mcp-servicenow/package-lock.json ./
RUN npm ci --ignore-scripts
COPY mcp-servicenow/tsconfig.json ./
COPY mcp-servicenow/src/ ./src/
COPY mcp-servicenow/lib/ ./lib/
COPY mcp-servicenow/deploy/ ./deploy/
RUN npx tsc

# ── Stage 2: Install webapp dependencies ───────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy mcp-servicenow built output so the file: dependency resolves
COPY mcp-servicenow/package.json /app/mcp-servicenow/package.json
COPY --from=mcp-build /app/mcp-servicenow/dist/ /app/mcp-servicenow/dist/
COPY --from=mcp-build /app/mcp-servicenow/node_modules/ /app/mcp-servicenow/node_modules/
COPY mcp-servicenow/lib/ /app/mcp-servicenow/lib/

WORKDIR /app/webapp
COPY webapp/package.json webapp/package-lock.json ./
RUN npm ci

# ── Stage 3: Build Next.js ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy mcp-servicenow (built)
COPY --from=mcp-build /app/mcp-servicenow/dist/ /app/mcp-servicenow/dist/
COPY --from=mcp-build /app/mcp-servicenow/node_modules/ /app/mcp-servicenow/node_modules/
COPY mcp-servicenow/package.json /app/mcp-servicenow/package.json
COPY mcp-servicenow/lib/ /app/mcp-servicenow/lib/

# Copy webapp deps + source
COPY --from=deps /app/webapp/node_modules/ /app/webapp/node_modules/
WORKDIR /app/webapp
COPY webapp/ ./

# Next.js collects anonymous telemetry — disable in CI/Docker
ENV NEXT_TELEMETRY_DISABLED=1

# Build standalone output for minimal production image
RUN npm run build

# ── Stage 4: Production runner ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy mcp-servicenow (needed at runtime for tool execution)
COPY --from=mcp-build /app/mcp-servicenow/dist/ /app/mcp-servicenow/dist/
COPY --from=mcp-build /app/mcp-servicenow/node_modules/ /app/mcp-servicenow/node_modules/
COPY mcp-servicenow/package.json /app/mcp-servicenow/package.json
COPY mcp-servicenow/lib/ /app/mcp-servicenow/lib/

# Copy Next.js standalone build
COPY --from=builder /app/webapp/.next/standalone/ ./webapp/
COPY --from=builder /app/webapp/.next/static/ ./webapp/.next/static/
COPY --from=builder /app/webapp/public/ ./webapp/public/

# Create logs directory (writable by nextjs user)
RUN mkdir -p /app/webapp/logs && chown nextjs:nodejs /app/webapp/logs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app/webapp
CMD ["node", "server.js"]

