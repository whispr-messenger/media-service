FROM node:22-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

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

FROM node:22-alpine AS production

LABEL maintainer="Whispr Team" \
    service="medias-service" \
    version="1.0.0" \
    environment="production" \
    org.opencontainers.image.source="https://github.com/whispr-messenger/media-service" \
    org.opencontainers.image.description="Whispr Media Service" \
    org.opencontainers.image.licenses="MIT"

# Install runtime dependencies (openssl required by Prisma on Alpine)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy built application and production deps from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package*.json ./

USER node

ENV NODE_ENV=production

# Expose ports
EXPOSE 3001 50051

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node dist/docker/health-check.js || exit 1

CMD ["node", "dist/docker/entrypoint.js"]

