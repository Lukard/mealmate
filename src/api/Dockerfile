# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY src/shared/package*.json ./src/shared/
COPY src/core/package*.json ./src/core/
COPY src/scraper/package*.json ./src/scraper/
COPY src/api/package*.json ./src/api/

# Install dependencies
RUN npm ci

# Copy source code
COPY src/shared ./src/shared
COPY src/core ./src/core
COPY src/scraper ./src/scraper
COPY src/api ./src/api
COPY tsconfig.json ./

# Build all required packages in order (shared -> core -> scraper -> api)
WORKDIR /app
RUN npm run build --workspace=@meal-automation/shared && \
    npm run build --workspace=@meal-automation/core && \
    npm run build --workspace=@meal-automation/scraper && \
    npm run build --workspace=@meal-automation/api

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src/shared/package*.json ./src/shared/
COPY --from=builder /app/src/core/package*.json ./src/core/
COPY --from=builder /app/src/scraper/package*.json ./src/scraper/
COPY --from=builder /app/src/api/package*.json ./src/api/

# Install ALL dependencies (including dev for drizzle-kit and tsx)
RUN npm ci

# Copy built files
COPY --from=builder /app/src/api/dist ./src/api/dist
COPY --from=builder /app/src/shared/dist ./src/shared/dist
COPY --from=builder /app/src/core/dist ./src/core/dist
COPY --from=builder /app/src/scraper/dist ./src/scraper/dist

# Copy scripts and config for database operations
COPY --from=builder /app/src/api/scripts ./src/api/scripts
COPY --from=builder /app/src/api/src/db ./src/api/src/db
COPY --from=builder /app/src/api/drizzle.config.ts ./src/api/drizzle.config.ts

# Copy entrypoint script
COPY src/api/docker-entrypoint.sh ./src/api/docker-entrypoint.sh
RUN chmod +x ./src/api/docker-entrypoint.sh

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check with longer start period for database setup
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start via entrypoint script (runs db setup then starts server)
WORKDIR /app/src/api
ENTRYPOINT ["./docker-entrypoint.sh"]
