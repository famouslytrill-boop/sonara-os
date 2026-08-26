# One container, no install step.
#
# `node:22-alpine` because this application has no npm dependencies at all --
# storage is `node:sqlite`, hashing is `node:crypto`, the server is `node:http`.
# There is nothing to install, so there is no `npm ci` layer, no lockfile to go
# stale, and no dependency tree anybody has to audit the licences of.
#
# ## The data directory is a volume, and the container does not own it
#
# The SQLite database, the generated audio and the CSRF secret all live in
# /data. Losing that is losing everybody's songs, so it is mounted rather than
# baked in -- and `docker-compose.yml` names the volume so that is hard to get
# wrong by accident.
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

# Not root. This process reads its own source and writes to /data, and nothing
# it does needs more than that.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV NODE_ENV=production \
    PORT=8787 \
    SONGSMITH_DATA_DIR=/data

EXPOSE 8787
VOLUME ["/data"]

# The health endpoint answers from the database rather than from a constant, so
# a container reporting healthy is one that can actually read its own storage.
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8787/healthz || exit 1

CMD ["node", "src/server.js"]
