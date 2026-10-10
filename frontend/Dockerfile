# Cashiery frontend — React (CRA) build served by nginx

# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# No package-lock.json is committed, so use `npm install` (not `npm ci`).
COPY package*.json ./
RUN npm install

COPY . .

# Skip CRA's build-time eslint — without a lockfile, fresh npm resolution pulls
# an eslint-plugin-jest that breaks eslint-config-react-app's jest overrides,
# and linting adds nothing inside an image build.
ENV DISABLE_ESLINT_PLUGIN=true
RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine

# CRA builds into build/ — serve it as static content.
COPY --from=build /app/build /usr/share/nginx/html

# SPA fallback + reverse proxy for /api -> backend service (see nginx.conf).
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
