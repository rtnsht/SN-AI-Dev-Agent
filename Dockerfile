# ============================================================================
# Multi-stage Dockerfile for SN AI Agent
# Works on: Railway, Render, DigitalOcean App Platform, any Docker host
# ============================================================================

# ── Stage 1: Build mcp-servicenow ──────────────────────────────────────────
FROM node:24-alpine AS mcp-build

WORKDIR /app/mcp-servicenow
COPY mcp-servicenow/package.json mcp-servicenow/package-lock.json ./
RUN npm ci --ignore-scripts
COPY mcp-servicenow/tsconfig.json ./
COPY mcp-servicenow/src/ ./src/
COPY mcp-servicenow/lib/ ./lib/
COPY mcp-servicenow/deploy/ ./deploy/
RUN npx tsc

# ── Stage 2: Install webapp dependencies ───────────────────────────────────
FROM node:24-alpine AS deps

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
FROM node:24-alpine AS builder

WORKDIR /app

# NEXT_PUBLIC_* vars are inlined at build time by Next.js (not read at runtime).
# Declare them as ARGs so they can be passed via --build-arg or Render/Railway env.
ARG NEXT_PUBLIC_APP_NAME="SN AI Agent"
ARG NEXT_PUBLIC_APP_TAGLINE="Say it. Ship it."
ARG NEXT_PUBLIC_APP_SUBTITLE="Spec-driven · Human-approved · AI-powered"
ARG NEXT_PUBLIC_APP_DESCRIPTION="AI-powered ServiceNow development"
ARG NEXT_PUBLIC_APP_LOGO="/logo-r-v10.svg"
ARG NEXT_PUBLIC_HERO_TAGLINE="r Works for You."
ARG NEXT_PUBLIC_PRIMARY_COLOR="blue"
ARG NEXT_PUBLIC_ACCENT_COLOR="purple"
ARG NEXT_PUBLIC_SHOW_INFO_BUTTON="true"
ARG NEXT_PUBLIC_SHOW_TOOL_DETAILS="false"
ARG NEXT_PUBLIC_SHOW_LIVE_STATUS="true"
ARG NEXT_PUBLIC_HERO_FEATURE_1=""
ARG NEXT_PUBLIC_HERO_FEATURE_2=""
ARG NEXT_PUBLIC_HERO_FEATURE_3=""
ARG NEXT_PUBLIC_TRUST_ITEM_1=""
ARG NEXT_PUBLIC_TRUST_ITEM_2=""
ARG NEXT_PUBLIC_TRUST_ITEM_3=""
ARG NEXT_PUBLIC_TRUST_ITEM_4=""
ARG NEXT_PUBLIC_FEATURES_EYEBROW=""
ARG NEXT_PUBLIC_FEATURES_TITLE=""
ARG NEXT_PUBLIC_STEPS_EYEBROW=""
ARG NEXT_PUBLIC_STEPS_TITLE=""
ARG NEXT_PUBLIC_HIGHLIGHT_TITLE=""
ARG NEXT_PUBLIC_HIGHLIGHT_DESC=""
ARG NEXT_PUBLIC_CTA_HEADLINE=""
ARG NEXT_PUBLIC_CTA_SUBTEXT=""
ARG NEXT_PUBLIC_HERO_VIDEO_URL=""
ARG NEXT_PUBLIC_WELCOME_BADGE="Spec-driven · Human-approved · AI-powered"
ARG NEXT_PUBLIC_WELCOME_CTA="I understand — let's go"
ARG NEXT_PUBLIC_WELCOME_FOOTER="This won't show again"

# Promote ARGs to ENVs so Next.js sees them during `npm run build`
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_TAGLINE=$NEXT_PUBLIC_APP_TAGLINE
ENV NEXT_PUBLIC_APP_SUBTITLE=$NEXT_PUBLIC_APP_SUBTITLE
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION
ENV NEXT_PUBLIC_APP_LOGO=$NEXT_PUBLIC_APP_LOGO
ENV NEXT_PUBLIC_HERO_TAGLINE=$NEXT_PUBLIC_HERO_TAGLINE
ENV NEXT_PUBLIC_PRIMARY_COLOR=$NEXT_PUBLIC_PRIMARY_COLOR
ENV NEXT_PUBLIC_ACCENT_COLOR=$NEXT_PUBLIC_ACCENT_COLOR
ENV NEXT_PUBLIC_SHOW_INFO_BUTTON=$NEXT_PUBLIC_SHOW_INFO_BUTTON
ENV NEXT_PUBLIC_SHOW_TOOL_DETAILS=$NEXT_PUBLIC_SHOW_TOOL_DETAILS
ENV NEXT_PUBLIC_SHOW_LIVE_STATUS=$NEXT_PUBLIC_SHOW_LIVE_STATUS
ENV NEXT_PUBLIC_HERO_FEATURE_1=$NEXT_PUBLIC_HERO_FEATURE_1
ENV NEXT_PUBLIC_HERO_FEATURE_2=$NEXT_PUBLIC_HERO_FEATURE_2
ENV NEXT_PUBLIC_HERO_FEATURE_3=$NEXT_PUBLIC_HERO_FEATURE_3
ENV NEXT_PUBLIC_TRUST_ITEM_1=$NEXT_PUBLIC_TRUST_ITEM_1
ENV NEXT_PUBLIC_TRUST_ITEM_2=$NEXT_PUBLIC_TRUST_ITEM_2
ENV NEXT_PUBLIC_TRUST_ITEM_3=$NEXT_PUBLIC_TRUST_ITEM_3
ENV NEXT_PUBLIC_TRUST_ITEM_4=$NEXT_PUBLIC_TRUST_ITEM_4
ENV NEXT_PUBLIC_FEATURES_EYEBROW=$NEXT_PUBLIC_FEATURES_EYEBROW
ENV NEXT_PUBLIC_FEATURES_TITLE=$NEXT_PUBLIC_FEATURES_TITLE
ENV NEXT_PUBLIC_STEPS_EYEBROW=$NEXT_PUBLIC_STEPS_EYEBROW
ENV NEXT_PUBLIC_STEPS_TITLE=$NEXT_PUBLIC_STEPS_TITLE
ENV NEXT_PUBLIC_HIGHLIGHT_TITLE=$NEXT_PUBLIC_HIGHLIGHT_TITLE
ENV NEXT_PUBLIC_HIGHLIGHT_DESC=$NEXT_PUBLIC_HIGHLIGHT_DESC
ENV NEXT_PUBLIC_CTA_HEADLINE=$NEXT_PUBLIC_CTA_HEADLINE
ENV NEXT_PUBLIC_CTA_SUBTEXT=$NEXT_PUBLIC_CTA_SUBTEXT
ENV NEXT_PUBLIC_HERO_VIDEO_URL=$NEXT_PUBLIC_HERO_VIDEO_URL
ENV NEXT_PUBLIC_WELCOME_BADGE=$NEXT_PUBLIC_WELCOME_BADGE
ENV NEXT_PUBLIC_WELCOME_CTA=$NEXT_PUBLIC_WELCOME_CTA
ENV NEXT_PUBLIC_WELCOME_FOOTER=$NEXT_PUBLIC_WELCOME_FOOTER

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
FROM node:24-alpine AS runner

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

# PORT is overridable — Railway/Render inject their own $PORT at runtime.
# Default 3000 matches local `npm run dev` behavior.
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE ${PORT}

WORKDIR /app/webapp
CMD ["node", "server.js"]

