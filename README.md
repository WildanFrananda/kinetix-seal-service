# kinetix-seal-service

Seal proves facts without revealing the data behind them, with Compact contracts on Midnight Preprod. It will
offer portable reputation credentials (S1), sealed-bid auctions (S2) and verified anonymous reports (S3). Today
it is the skeleton: the sponsor wallet that pays holders' DUST fees, kept synced, observable and recorded.

- Plan and rulings: `kinetix-infrastructure/docs/SEAL-SERVICE.md`.
- Conventions and traps: `CLAUDE.md`.

## Stack

| | |
| --- | --- |
| runtime | Node 26.12.1, ESM |
| language | TypeScript 7.0.2 (the Go compiler), strict |
| HTTP | Fastify 5.12.5 |
| database | PostgreSQL 16 through Prisma ORM 7.10.0 and `@prisma/adapter-pg` |
| Midnight | wallet SDK 1.2.0, midnight-js 4.1.1, Preprod through Blockfrost |
| metrics | prom-client 15.1.3 |
| lint and format | Biome 2.5.15 |
| tests | `node:test`, hand-written fakes, real Postgres |

## The gate

```sh
bin/dev bin/ci
```

It runs in Docker, as on CI: install, generate, Biome, `tsc`, migrate twice, the drift check, and the tests.

## Running

The image serves HTTP on `KINETIX_SEAL_HTTP_PORT`:
- `/health`: liveness;
- `/health/ready`: 200 when Postgres answers and the sponsor wallet is synced;
- `/metrics`: Prometheus.

The migrator is the same image:

```sh
node_modules/.bin/prisma migrate deploy
```

Every setting is listed in `.env.example`; all are required. The sponsor wallet's state lives under
`KINETIX_SEAL_WALLET_STATE_DIR`, which must be a volume.

## Admin commands

Run them only while the service is stopped: two processes on one wallet seed double-spend DUST.

```sh
node dist/src/cli/sponsor_address.js                        # the sponsor's address, for the faucet (no wallet started)
node dist/src/cli/register_dust.js                          # register the sponsor's NIGHT for DUST
KINETIX_SEAL_SPLIT_OUTPUTS=10 node dist/src/cli/split_night.js   # split the NIGHT into ten UTXOs
```
