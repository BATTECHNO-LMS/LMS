# Multi-stage production build for eprojecto frontend (Vite SPA).
# Runtime is unprivileged Nginx (non-root, port 8080).

FROM node:20.19-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=
ARG VITE_APP_ORIGINS=https://eprojecto.com
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ORIGINS=$VITE_APP_ORIGINS

RUN npm run build \
    && find /app/dist -name '*.map' -type f -delete

# Unprivileged Nginx listens on 8080 as non-root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Drop world-writable bits on static assets (image default user is nginx).
USER root
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && find /usr/share/nginx/html -type d -exec chmod 755 {} \; \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} \;
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
