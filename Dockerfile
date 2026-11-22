# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY assets ./assets

# prisma.config.ts mengevaluasi env('DATABASE_URL') saat load; nilai placeholder
# hanya dipakai sementara di tahap generate dan tidak disimpan ke image akhir.
RUN DATABASE_URL="mysql://placeholder:placeholder@127.0.0.1:3306/mobiljuragan" npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json /app/prisma.config.ts ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/assets ./assets
COPY --from=builder --chown=node:node /app/src ./src

RUN mkdir -p /var/lib/mobiljuragan/media && chown -R node:node /var/lib/mobiljuragan

USER node

ENV NODE_ENV=production
ENV HOST=127.0.0.1
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/server.js"]
