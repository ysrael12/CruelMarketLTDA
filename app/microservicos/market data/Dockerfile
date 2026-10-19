# syntax=docker/dockerfile:1

FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN if [ -f bun.lock ] || [ -f bun.lockb ]; then \
      bun install --frozen-lockfile; \
    else \
      bun install; \
    fi

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS prod-deps
COPY package.json bun.lock* ./
RUN if [ -f bun.lock ] || [ -f bun.lockb ]; then \
      bun install --frozen-lockfile --production; \
    else \
      bun install --production; \
    fi

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/market.db \
    CONFIG_PATH=/app/config/ativos.json

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY config ./config
COPY package.json ./

RUN mkdir -p /app/data && chown bun:bun /app/data

USER bun
EXPOSE 3000
CMD ["bun", "dist/main.js"]