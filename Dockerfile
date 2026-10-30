FROM --platform=$BUILDPLATFORM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a AS compactc

ARG BUILDARCH

COPY toolchain/compactc.sha256 /tmp/compactc.sha256

RUN case "$BUILDARCH" in \
      arm64) triple=aarch64-unknown-linux-musl ;; \
      amd64) triple=x86_64-unknown-linux-musl ;; \
      *) echo "unsupported architecture: $BUILDARCH" >&2; exit 1 ;; \
    esac \
 && zip="compactc_v0.31.1_${triple}.zip" \
 && wget -q -O "/tmp/$zip" "https://github.com/LFDT-Minokawa/compact/releases/download/compactc-v0.31.1/$zip" \
 && cd /tmp \
 && grep " $zip\$" compactc.sha256 | sha256sum -c - \
 && mkdir /compactc \
 && unzip -q "/tmp/$zip" -d /compactc

FROM --platform=$BUILDPLATFORM node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS contracts

COPY --from=compactc /compactc /opt/compactc
COPY --from=compactc /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ENV PATH=/opt/compactc:$PATH

WORKDIR /app

COPY bin/contracts ./bin/contracts
COPY contracts ./contracts

RUN --mount=type=cache,id=kinetix-seal-zk-params,target=/zk-params \
    MIDNIGHT_PP=/zk-params sh bin/contracts

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
COPY --from=contracts /app/managed ./managed
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
COPY --from=contracts /app/managed ./managed
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN mkdir -p /var/lib/seal/wallet \
 && chown node:node /var/lib/seal/wallet

USER node

EXPOSE 8012

HEALTHCHECK --interval=15s --timeout=5s --start-period=15m --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.KINETIX_SEAL_HTTP_PORT + '/health/ready').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/src/main.js"]
