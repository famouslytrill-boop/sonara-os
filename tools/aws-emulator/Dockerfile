# One container, one port, no dependencies.
#
# `node:22-alpine` because this has no npm dependencies at all -- there is no
# install step, so the image is the runtime plus about two thousand lines of
# JavaScript. `unzip` is the one addition: Lambda deployment packages are zips,
# and unpacking them with a reader written here would silently drop whatever
# entry it did not handle.
FROM node:22-alpine

RUN apk add --no-cache unzip

WORKDIR /app

# No `npm install`. There is nothing to install, which is most of why this
# starts in well under a second.
COPY package.json ./
COPY src ./src

# Not root. The emulator writes only to its state directory and to /tmp for
# Lambda packages, and nothing here needs more than that.
RUN mkdir -p /var/lib/aws-emulator && chown -R node:node /app /var/lib/aws-emulator
USER node

ENV AWS_EMULATOR_PORT=4566
EXPOSE 4566

# The health endpoint answers without touching any stored state, so a container
# reporting healthy is one that can actually route a request rather than one
# whose process happens to be alive.
HEALTHCHECK --interval=10s --timeout=3s --start-period=2s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:4566/_emulator/health || exit 1

CMD ["node", "src/server.js"]
