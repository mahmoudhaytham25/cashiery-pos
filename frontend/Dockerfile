# Cashiery frontend — React (CRA) build served by nginx

# ---- Build stage ----
FROM node:24-alpine AS build
WORKDIR /app

# package-lock.json is committed, so `npm ci` gives a reproducible install.
COPY package*.json ./
RUN npm ci

COPY . .

# Skip CRA's build-time eslint — fresh npm resolution can pull an
# eslint-plugin-jest that breaks eslint-config-react-app's jest overrides,
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
