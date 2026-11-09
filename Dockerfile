FROM node:26.13.0-bookworm-slim AS build
WORKDIR /app

RUN npm install --global pnpm@12.16.1
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run generate \
    && pnpm run build:sdk \
    && pnpm run build:backend \
    && pnpm run build:frontend \
    && pnpm --filter @calendar/backend --prod deploy /runtime/backend

FROM node:26.13.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /runtime/backend ./apps/backend
COPY --from=build --chown=node:node /app/apps/frontend/dist ./apps/frontend/dist
USER node
EXPOSE 3000
CMD ["node", "apps/backend/dist/main.js"]
