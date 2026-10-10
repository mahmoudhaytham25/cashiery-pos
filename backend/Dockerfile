# Cashiery backend — Express API
# Base: node:20-alpine. bcrypt ships prebuilt musl binaries for this version;
# if a prebuilt download ever fails during build, switch the base image to
# node:20-slim (glibc) — no other changes are needed.
FROM node:20-alpine

WORKDIR /app

# Install production dependencies first for better layer caching.
# package-lock.json is committed, so `npm ci` gives a reproducible install.
COPY package*.json ./
RUN npm ci --omit=dev

# App source (node_modules, .env, tests etc. are excluded via .dockerignore)
COPY . .

ENV NODE_ENV=production

# App listens on process.env.PORT (default 5000)
EXPOSE 5000

# docker-entrypoint.sh waits for Postgres, applies node-pg-migrate
# migrations (npm run migrate:up), then execs `node index.js`.
CMD ["sh", "docker-entrypoint.sh"]
