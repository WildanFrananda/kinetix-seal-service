FROM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a AS compactc

ARG TARGETARCH

COPY compactc.sha256 /tmp/compactc.sha256

RUN case "$TARGETARCH" in \
      arm64) triple=aarch64-unknown-linux-musl ;; \
      amd64) triple=x86_64-unknown-linux-musl ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && zip="compactc_v0.31.1_${triple}.zip" \
 && wget -q -O "/tmp/$zip" "https://github.com/LFDT-Minokawa/compact/releases/download/compactc-v0.31.1/$zip" \
 && cd /tmp \
 && grep " $zip\$" compactc.sha256 | sha256sum -c - \
 && mkdir /compactc \
 && unzip -q "/tmp/$zip" -d /compactc

FROM node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe

COPY --from=compactc /compactc /opt/compactc
COPY --from=compactc /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ENV PATH=/opt/compactc:$PATH
