FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files (including lockfile) and install full deps for build
COPY package*.json ./
COPY package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy tsconfig and source, then build
COPY tsconfig*.json ./
COPY src/ ./src/
RUN npm run build

# Remove devDependencies to keep only production deps
RUN npm prune --production

# Fix healthcheck permission (preserved when copied to production stage)
RUN chmod +x dist/docker/health-check.js

FROM node:22-alpine AS production

LABEL maintainer="Whispr Team" \
    service="medias-service" \
    version="1.0.0" \
    environment="production" \
    org.opencontainers.image.source="https://github.com/whispr-messenger/media-service" \
    org.opencontainers.image.description="Whispr Media Service" \
    org.opencontainers.image.licenses="MIT"

# Bug 1 Fix: Install OpenSSL for Prisma (libssl required by query engine)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy built application and production deps from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Run as non-root (node user uid=1000 on Alpine)
USER node

ENV NODE_ENV=production

# Health check — use node explicitly (no shell in minimal images)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD ["node", "dist/docker/health-check.js"]

# Start the application
CMD ["node", "dist/docker/entrypoint.js"]
