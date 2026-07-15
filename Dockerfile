# SONARA OS Express runtime.
# No secrets are baked into this image; configuration comes from environment
# variables at run time (see .env.example for names).
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js vercel.json ./
COPY api ./api
COPY routes ./routes
COPY lib ./lib
COPY scripts ./scripts
COPY public ./public

# Bake the runtime route codemods the same way vercel-build does.
RUN node scripts/apply-last9-routes.cjs \
  && node scripts/apply-creator-music-readonly.cjs \
  && node scripts/apply-formula-routes.cjs \
  && node scripts/apply-ecosystem-routes.cjs \
  && node scripts/apply-premium-brand-system.cjs \
  && node --check server.js

RUN chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server.js"]
