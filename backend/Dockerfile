# Cashiery backend — Express API
# Base: node:24-alpine (Node 24 LTS). bcrypt uses N-API, so its prebuilt
# binaries are ABI-stable across Node versions; if a prebuilt download ever
# fails during build, switch the base image to node:24-slim (glibc).
FROM node:24-alpine

WORKDIR /app

# Install production dependencies first for better layer caching.
# package-lock.json is committed, so `npm ci` gives a reproducible install.
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# App source (node_modules, .env, tests etc. are excluded via .dockerignore)
COPY --chown=node:node . .

ENV NODE_ENV=production

# App listens on process.env.PORT (default 5000)
EXPOSE 5000

# Run as the node image's built-in non-root user (the app writes nothing to disk).
USER node

# docker-entrypoint.sh waits for Postgres, applies node-pg-migrate
# migrations (node scripts/migrate.js up), then execs `node index.js`.
CMD ["sh", "docker-entrypoint.sh"]
