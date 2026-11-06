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

FROM alpine:3.24.0@sha256:a2d49ea686c2adfe3c992e47dc3b5e7fa6e6b5055609400dc2acaeb241c829f4 AS step

ARG TARGETARCH

COPY step.sha256 /tmp/step.sha256

RUN tarball="step_linux_0.30.2_${TARGETARCH}.tar.gz" \
 && wget -q -O "/tmp/$tarball" "https://github.com/smallstep/cli/releases/download/v0.30.2/$tarball" \
 && cd /tmp \
 && grep " $tarball\$" step.sha256 | sha256sum -c - \
 && tar -xzf "/tmp/$tarball" -C /tmp \
 && install -m 0755 /tmp/step_0.30.2/bin/step /step

FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c

COPY --from=compactc /compactc /opt/compactc
COPY --from=compactc /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=step /step /usr/local/bin/step

ENV PATH=/opt/compactc:$PATH
