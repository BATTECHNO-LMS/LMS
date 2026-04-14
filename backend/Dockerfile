# Optional production image — set DATABASE_URL, JWT_SECRET, CORS_ORIGINS at runtime.
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
