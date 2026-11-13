FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS compactc

ARG TARGETARCH

COPY compactc.sha256 /tmp/compactc.sha256

RUN case "$TARGETARCH" in \
      arm64) triple=aarch64-unknown-linux-musl ;; \
      amd64) triple=x86_64-unknown-linux-musl ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && zip="compactc_v0.36.0_${triple}.zip" \
 && wget -q -O "/tmp/$zip" "https://github.com/LFDT-Minokawa/compact/releases/download/compactc-v0.36.0/$zip" \
 && cd /tmp \
 && grep " $zip\$" compactc.sha256 | sha256sum -c - \
 && mkdir /compactc \
 && unzip -q "/tmp/$zip" -d /compactc

FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS step

ARG TARGETARCH

COPY step.sha256 /tmp/step.sha256

RUN tarball="step_linux_0.30.2_${TARGETARCH}.tar.gz" \
 && wget -q -O "/tmp/$tarball" "https://github.com/smallstep/cli/releases/download/v0.30.2/$tarball" \
 && cd /tmp \
 && grep " $tarball\$" step.sha256 | sha256sum -c - \
 && tar -xzf "/tmp/$tarball" -C /tmp \
 && install -m 0755 /tmp/step_0.30.2/bin/step /step

FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68

COPY --from=compactc /compactc /opt/compactc
COPY --from=compactc /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=step /step /usr/local/bin/step

ENV PATH=/opt/compactc:$PATH
