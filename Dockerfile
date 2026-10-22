FROM node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS build

ENV PRISMA_HIDE_UPDATE_MESSAGE=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate \
 && npx tsc -p tsconfig.json \
 && npx prisma --version \
 && test -x "$(ls node_modules/@prisma/engines/schema-engine-* | head -n 1)" \
 && test -f dist/src/main.js

FROM node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe

ARG KINETIX_SEAL_SERVICE_VERSION

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    KINETIX_SEAL_SERVICE_VERSION=$KINETIX_SEAL_SERVICE_VERSION

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force

COPY --from=build /app/node_modules/@prisma/engines/ ./node_modules/@prisma/engines/
COPY --from=build /app/dist ./dist
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN mkdir -p /var/lib/seal/wallet \
 && chown node:node /var/lib/seal/wallet

USER node

EXPOSE 8012

HEALTHCHECK --interval=15s --timeout=5s --start-period=15m --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.KINETIX_SEAL_HTTP_PORT + '/health/ready').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/src/main.js"]
