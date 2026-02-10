FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY drizzle.config.ts ./

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/drizzle.config.ts ./

# SQLite data directory — mount as a volume
RUN mkdir -p /app/data
VOLUME /app/data

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/localengine.sqlite

EXPOSE 3000

CMD ["node", "dist/index.js"]
