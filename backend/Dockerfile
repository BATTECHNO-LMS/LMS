# eprojecto backend — production runtime image (non-root).
# Chromium + LibreOffice support PDF/DOCX report generation.
FROM node:20.19-alpine

WORKDIR /app

# wget: compose healthcheck. Chromium + fonts: analytics PDF (Puppeteer).
# libreoffice: field-training evaluation DOCX → PDF (headless soffice).
RUN apk add --no-cache \
    wget \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    fontconfig \
    libreoffice \
    && mkdir -p /app/uploads /app/tmp /home/node/.cache /home/node/.config \
    && chown -R node:node /app /home/node

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV HOME=/home/node
ENV XDG_CONFIG_HOME=/home/node/.config
ENV XDG_CACHE_HOME=/home/node/.cache
RUN if [ -x /usr/bin/chromium ] && [ ! -e /usr/bin/chromium-browser ]; then ln -s /usr/bin/chromium /usr/bin/chromium-browser; fi

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma

USER node
RUN npm ci --omit=dev && npx prisma generate

USER root
COPY --chown=node:node . .
COPY assets/fonts /usr/share/fonts/sakkal
RUN fc-cache -f || true \
    && chown -R node:node /app/uploads /app/tmp /home/node \
    && chmod -R u+rwX,go-w /app

USER node

ENV NODE_ENV=production
ENV PORT=4000
ENV UPLOAD_DIR=/app/uploads

EXPOSE 4000

# `npm start` runs `prisma migrate deploy` then the API (see scripts/start-production.js).
# Containers must never run `prisma migrate dev` / create migrations at boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["npm", "start"]
