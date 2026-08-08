FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

EXPOSE 10000

# `npm start` runs `prisma migrate deploy` then the API (see scripts/start-production.js).
# Containers must never run `prisma migrate dev` / create migrations at boot.
CMD ["npm", "start"]
