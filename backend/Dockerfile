FROM node:20-alpine

WORKDIR /app

# wget: compose healthcheck. Chromium + fonts: server-side PDF export (Puppeteer).
RUN apk add --no-cache \
    wget \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN if [ -x /usr/bin/chromium ] && [ ! -e /usr/bin/chromium-browser ]; then ln -s /usr/bin/chromium /usr/bin/chromium-browser; fi

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# `npm start` runs `prisma migrate deploy` then the API (see scripts/start-production.js).
# Containers must never run `prisma migrate dev` / create migrations at boot.
CMD ["npm", "start"]
