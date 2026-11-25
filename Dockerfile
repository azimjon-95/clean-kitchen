# Сайт Clean Kitchen: сборка Vite → Caddy (HTTPS, статика, прокси /api). Используется deploy/docker-compose.prod.yml backend-репозитория.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_URL=""
ARG VITE_ALLOW_GUEST="false"
ENV VITE_API_URL=${VITE_API_URL} VITE_ALLOW_GUEST=${VITE_ALLOW_GUEST}
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
