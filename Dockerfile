# SONARA OS Express runtime.
# No secrets are baked into this image; configuration comes from environment
# variables at run time (see .env.example for names).
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable \
  && corepack prepare pnpm@11.1.1 --activate \
  && pnpm install --prod --frozen-lockfile

COPY server.js vercel.json ./
COPY api ./api
COPY routes ./routes
COPY lib ./lib
COPY config ./config
COPY scripts ./scripts
COPY public ./public

# Apply the exact same deterministic runtime patch chain used by Vercel, then
# verify that the production entry point parses and starts without importing
# development-only packages.
RUN pnpm run apply:runtime \
  && pnpm run build

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server.js"]
