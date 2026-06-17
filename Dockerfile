FROM node:22-alpine
WORKDIR /usr/src/app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
EXPOSE 80
CMD [ "pnpm", "start" ]
