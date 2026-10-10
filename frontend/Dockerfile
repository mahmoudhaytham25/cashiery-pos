# Cashiery frontend — React (Vite) build served by nginx

# ---- Build stage ----
FROM node:24-alpine AS build
WORKDIR /app

# package-lock.json is committed, so `npm ci` gives a reproducible install.
COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine

# Vite builds into dist/ — serve it as static content.
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback + reverse proxy for /api -> backend service (see nginx.conf).
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
