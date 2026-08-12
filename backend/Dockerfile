FROM node:20-alpine

WORKDIR /app

# wget used by compose healthcheck
RUN apk add --no-cache wget

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
