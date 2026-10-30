# kinetix-seal-service

Seal proves facts without revealing the data behind them, with Compact contracts on Midnight Preprod. The
plan, the rulings (SEAL-D1 to D11) and the gates are in `kinetix-infrastructure/docs/SEAL-SERVICE.md`; the
measurements behind them come from the lab harness `kinetix-seal-spike/` at the estate root.

This repository is the service skeleton (plan §11 step 3). It runs one thing for real: the sponsor wallet that
will pay every holder's DUST fee. It keeps the wallet synced and its state on a volume. It reports DUST health
through `/health/ready` and `/metrics`, and records every change of condition in Postgres. No feature exists
yet: the gRPC server, the mesh certificate and the watcher arrive with S1, which has the first RPC and the
first contract to watch.

## Everything runs in Docker

Nothing is installed on the laptop. `bin/dev` runs a command in the toolchain (`toolchain/compose.yaml`:
Node 26.12.1 with the Compact compiler, and a throwaway Postgres 16). Both are pinned by digest, and the
compiler's zip by its SHA-256 (`toolchain/compactc.sha256`).

```sh
bin/dev bin/ci          # the whole gate, the same one CI runs
bin/dev bin/test        # the tests only, after a build
bin/dev npx biome check --write .
bin/dev down            # stop the toolchain and drop its volumes
```

`bin/ci` installs with `npm ci --ignore-scripts`, generates the Prisma client, compiles the contracts
(`bin/contracts`), runs Biome and `tsc`, then migrates the test database twice: the second run must apply
nothing. It then compares the database with `prisma/schema.prisma`, which must show no drift, and runs every
test. It refuses to start without the toolchain's database: a skipped database test proves nothing.

## Layout, and the rule it encodes

- `src/domain/`: rules as plain functions, with no I/O.
- `src/application/`: services and the ports they depend on. `ports/` holds the interfaces that infrastructure
  classes implement.
- `src/infrastructure/<adapter>/`: config, observability, HTTP, Postgres, Midnight, scheduling, shutdown.
- `src/main.ts`: the only composition root, wired by hand, with no container.
- `src/cli/`: the admin commands.
- `src/types/`: every data shape, one per file, named after the type.
- `tests/`, never beside the code. `tests/fakes/` holds hand-written fakes; there is no mocking framework.
  `tests/database/` runs against real Postgres.

## How the rules are enforced

- **Biome** (`biome.json`) formats and lints. The house layout is two spaces, double quotes, no semicolons, no
  trailing commas and 120 columns. Wrapping puts one element per line. Biome also enforces `type` over
  `interface` everywhere except `src/application/ports/`, `import type`, no `any`, no `console` and no
  non-null assertion.
- **TypeScript 7** (the Go compiler), strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and
  `erasableSyntaxOnly`. ESM only (`"type": "module"`, `NodeNext`). Imports name the `.ts` file, and
  `rewriteRelativeImportExtensions` emits `.js`.
- **Zero comments** in code. Reasoning that needs prose goes here or in a test name.
- **Functions are declared with `function`** (the user's rule, 2026-10-22, *"jangan pake arrow function pake
  function, kecuali callback boleh pake anonymous function"*). An arrow is only an anonymous callback passed as an
  argument (`.map((x) => …)`, a route handler, `.then(…)`). It is never a value bound to a name, a class field or
  a property. `biome-plugins/no_arrow_definitions.grit` enforces this.
- **Exports go at the bottom of the file, as in identity** (*"export selalu di bawah file seperti identity"*):
  - a class: `export default ClassName`, imported as `import ClassName from`;
  - functions and constants: `export { a, b }`;
  - types and interfaces: `export type { A }`. `verbatimModuleSyntax` refuses `export default` of a type, which
    is why ports differ from identity's here.

  `biome-plugins/exports_at_the_bottom.grit` refuses an inline `export` declaration.
- **English only.**

## Conventions

- **Config fails fast.** Every setting is `KINETIX_SEAL_*`, required, with no default (`read_seal_config.ts`).
  A missing or invalid value stops the start with every problem named at once, and never prints a value.
- **`KINETIX_SEAL_SERVICE_VERSION` is baked into the image** from the build argument. CI checks it, and
  `kinetix_build_info` reports it.
- **Logs** are one JSON line per event on stdout: `timestamp`, `level`, `message`, `logger`, `request_id`, then
  the fields. A field never overwrites a reserved key.
- **Every byte written to stdout and stderr is redacted** before it leaves the process (`redactOutput`). The
  Blockfrost key travels inside the indexer and node URLs, and the Polkadot RPC layer under the wallet SDK logs
  those URLs on every disconnect. That leaked the dev key on 2026-10-21. Do not log around the redaction.
- **Metrics follow the estate contract**: `kinetix_http_requests_total`, `kinetix_http_request_duration_seconds`
  and `kinetix_build_info`, with routes labelled by template and an `unmatched` bucket. The sponsor's own are
  `kinetix_seal_sponsor_*`. Everything is seeded at zero.
- **Probes**:
  - `/health` answers `{"status":"ok"}` without naming the framework, runtime, version or port.
  - `/health/ready` is 200 only when a real query reaches Postgres and the sponsor wallet is synced.
  - A sponsor out of DUST stays ready: that is an alert, not an outage.

## The sponsor wallet

- **The sponsor's address**, for the faucet: `node dist/src/cli/sponsor_address.js`, which needs only
  `KINETIX_SEAL_NETWORK_ID` and `KINETIX_SEAL_SPONSOR_MNEMONIC` and starts no wallet, so it is safe while the
  service runs.
- **One process per seed, ever.** Two wallet instances on one seed double-spend DUST. The admin commands
  start their own instance, so they run only while the service is stopped:
  `docker compose run --rm kinetix-seal-service node dist/src/cli/register_dust.js`, or `split_night.js` with
  `KINETIX_SEAL_SPLIT_OUTPUTS`.
- **A restore takes about ten minutes.** The spike measured 506 s and 10 min on the VPS. The HTTP server
  starts first, so `/health` answers and `/health/ready` reads `syncing` until then. The image's healthcheck
  has a 15-minute start period, and compose must give at least as much; otherwise every deploy fails its wait
  and rolls back. A fresh wallet syncs from genesis in about 2 hours.
- **The state volume** (`KINETIX_SEAL_WALLET_STATE_DIR`) holds the serialized wallet. It is checkpointed every
  `KINETIX_SEAL_WALLET_CHECKPOINT_SECONDS` and on SIGTERM, atomically, mode 600. Losing it costs a full sync,
  not funds: the seed is in SOPS. Estate backups do not cover it.
- **Error 170.** The node sometimes rejects a DUST spend as `InvalidDustSpendProof`: midnight-wallet #804, open,
  in `dust-wallet` 4.2.0. The rejected coin then vanishes from the wallet for about three hours, the DUST grace
  period. With one DUST coin that stops all sponsoring, so the sponsor's NIGHT is split into about ten UTXOs
  (`split_night.js`), each of which generates its own DUST coin. `kinetix_seal_sponsor_dust_coins` falling is
  the signal.
- **Fees** were 0 to 1 SPECK per transaction on Preprod (2026-10-21). `additionalFeeOverhead` is 1,000 SPECK,
  as in the official example: the overhead is paid on every transaction.

## Contracts

`contracts/` is a project of its own, as `kinetix-notary-service/contracts/` is for Solidity:

```
contracts/
  package.json, package-lock.json      the Compact dependencies, pinned with integrity hashes
  src/<feature>/<Feature>.compact      the deployable contract, which composes the modules
  src/<feature>/<Module>.compact       one module per concern, and one struct per file
```

- **`bin/contracts`** installs `contracts/node_modules` (`npm ci`, scripts off), then compiles each
  `src/<feature>/<Feature>.compact` into `managed/<feature>/` with `compactc` 0.31.1, with
  `COMPACT_PATH=contracts/node_modules` so libraries are imported by package path. `managed/` holds the
  TypeScript contract, the ZKIR and the proving keys: a build output, never committed. Code imports it as
  `#contracts/<feature>/contract/index.js`, through `package.json`'s `imports`, so the same path works from
  `src/`, `tests/` and `dist/`.
- **OpenZeppelin Contracts for Compact** (`@openzeppelin/compact-contracts`, MIT) is the library, as
  OpenZeppelin's Solidity contracts are notary's. 0.3.0 targets ledger 8 and compiler 0.31.0 and was audited in
  August and October 2026; pre-releases (`-alpha`, `-rc`) are unaudited and never used. It ships no witnesses:
  every witness here is ours. 0.3.0 was ten days old when the user asked for it (2026-10-30, *"oke tolong
  gunakan"*), inside the two-week rule; its `Pausable` is identical to 0.3.0-rc.2, which the October audit
  covers, and the package carries npm provenance. Its CLI dependency drags `ansi-regex`, pinned to 6.4.0 by
  `overrides` because 6.5.0 was a day old.
- **The compiler is pinned.** Under SEAL-D10 the holder key and the leaf are `transientHash`, which may change
  between compiler versions, so a compiler change is a new contract generation (`SEAL-SERVICE.md` §6.4).
- **Keys are generated in CI or in the image build** (the Dockerfile's `contracts` stage, on the build
  platform), never on the VPS: `zkir` dies with SIGILL on a CPU without ADX. Key generation downloads the
  public parameters into `MIDNIGHT_PP` (the toolchain's `zk_params` volume, a build cache in Docker).

### Compact house style

- **Every file starts with `// SPDX-License-Identifier: MIT`**, as every Solidity file does: the single
  comment allowed (the user, 2026-10-30, *"kalau emang harus pasang lisensi kaya solidity boleh pasang MIT"*).
  `compactc` does not ask for it; notary's `.sol` files carry it because solc warns. Nothing else is a comment.
- **Exports sit at the bottom**, in one `export { … };` block, in the contract and in every module (the user,
  2026-10-30, *"di kode compact nya bisa export nya ngga inline ga?"*). The compiled contract, its
  `contract-info.json` and its ZKIR were compared byte for byte against the inline form: identical.
- **Modules are imported without a prefix**, so their ledger fields, witnesses and circuits keep their own
  names in the TypeScript contract. Libraries are imported with one (`prefix Pausable_;`), so their names say
  where they come from: `Pausable__isPaused`.
- **A module never imports another stateful module.** Composition happens in the deployable contract. The
  compiler duplicates the state of a module reached twice (LFDT-Minokawa/compact#270, OpenZeppelin's note in
  `Initializable`). A struct-only module may be imported anywhere.
- **`_name` is an unguarded building block** (OpenZeppelin's convention): `_issue`, `_approvePredicate`. Only
  the deployable contract calls it, after `assertIssuer()`. A name without the underscore guards itself.
- English only, and every value written to the ledger passes through `disclose`.

### Registry generations (SEAL-D12, D13)

- **The service deploys its own registry.** `RegistryGenerations` (`src/application/`) reconciles the
  `registry_generations` table with the chain every `KINETIX_SEAL_REGISTRY_CHECK_SECONDS`, once the sponsor is
  past `syncing`. The rule is a pure function, `src/domain/registry_generation_decision.ts`.
- **The sponsor wallet pays** for every transaction seal makes itself, through the proof server
  (`MidnightRegistryChain`). There is no second wallet.
- **A generation is anchored to the block its deploy landed in.** A different hash at that height, or no block
  there while the tip is below it and the contract has no state, means the chain was reset; it must be seen
  twice in a row. A changed build digest (the SHA-256 of the verifier keys) means the contract was rebuilt.
  Either retires the generation and deploys the next.
- **Unknown is not an answer.** An indexer that fails or times out makes the check `unknown`, and the service
  waits. Every network step has a deadline, `KINETIX_SEAL_MIDNIGHT_STEP_SECONDS`.
- **A deploy is recorded before it is submitted** (`deploying`, with the contract address the unproven deploy
  already knows). If it never confirms, the next check retires it as `interrupted` and deploys again; the
  orphan, if it landed, costs one fee and holds nothing.
- **The issuer secret** (`KINETIX_SEAL_ISSUER_SECRET`, 32 bytes of lowercase hex, in SOPS, one per environment)
  is redacted from every output. The maintenance authority's signing key is derived from it and the generation
  number, so nothing stores it: every change is a new generation anyway.

### Testing

- **The circuits run in memory** (`tests/infrastructure/midnight/in_memory_credential_registry.ts`): the
  unproven deploy and call builders of midnight-js execute each circuit against a real contract state, with
  no proof and no network. A failed `assert` carries its message in the error. An error thrown by a witness
  arrives wrapped in `ContractRuntimeError: Error executing circuit '…'`, with the witness's error as its
  `cause`.
- **`present` must stay at k=12** (a test reads its ZKIR): that is what keeps a phone at about a minute
  (SEAL-D11). A change that grows it is a decision for the user, not a refactor.

### The credential registry (S1)

`contracts/src/credential_registry/`:

| file | holds |
| --- | --- |
| `CredentialRegistry.compact` | the deployable contract: the constructor, `issue`, `revoke`, `approvePredicate`, `withdrawPredicate`, `pause`, `unpause`, `present` |
| `IssuerAuthority.compact` | `issuerPk`, `proposedIssuerPk`, the `issuerSecret` witness, `assertIssuer`, and the two-step `proposeIssuer`/`acceptIssuer` |
| `IssuedCredentials.compact` | `issued`, a `HistoricMerkleTree<20, Bytes<32>>` of leaves: `_issue`, `_revoke`, `assertIssued` |
| `ApprovedPredicates.compact` | `predicates`, keyed by `predicateId` (`persistentHash` of the content): `_approvePredicate`, `_withdrawPredicate`, `approvedPredicate` |
| `Presentations.compact` | `presentations`, challenge to predicate id: `assertUnanswered`, `_recordPresentation` |
| `Holder.compact` | the holder's witnesses, `holderPublicKey` and `credentialLeaf` (`transientHash`, SEAL-D10) |
| `Credential`, `CredentialLeaf`, `Predicate`, `PredicateKey` | one struct each |

- **Predicates are ledger rows the issuer approves** (G3's finding: free minimums let a verifier probe a holder's
  exact values). A content-addressed id can never come to mean other minimums. `present(challenge, id)` proves
  against the row and records `challenge → id`. Withdrawing a predicate refuses new presentations and leaves the
  recorded ones readable.
- **Revocation** writes the default leaf at the index and resets the tree's history, so only the current root
  proves. There is no revoked set: checking one would put the leaf in the public transcript.
- **Pause** (OpenZeppelin's `Pausable`, by the issuer) stops `issue`, `approvePredicate` and `present`. It
  never stops what an incident needs: `revoke`, `withdrawPredicate` and the issuer hand-over still work.
- **Witnesses** (`src/infrastructure/midnight/credential_registry_witnesses.ts`) refuse a secret to the wrong
  role: the issuer's private state answers only `issuerSecret`; a holder's answers the rest.

## Prisma

- Prisma ORM 7.10.0 with `@prisma/adapter-pg`. The `prisma-client` generator writes TypeScript into
  `src/infrastructure/postgres/generated/`, which is gitignored and regenerated by every build.
- **The migrator is this image** with the command `node_modules/.bin/prisma migrate deploy`, the estate's rule
  (`compose.prod.yaml` rule 1). So the Prisma CLI is a production dependency.
- **The schema engine is a native binary that the CLI downloads on first use**, from Prisma's host, with its
  checksum verified. `npm ci --ignore-scripts` skips the postinstall that would fetch it. The Dockerfile's build
  stage therefore runs the CLI, checks that the engine exists, and copies it into the final image, so the
  migrator never downloads anything in production. `openssl` is installed so that Prisma picks the
  `openssl-3.0.x` engine.
- `prisma.config.ts` reads `KINETIX_SEAL_DATABASE_URL` without a default: `generate` needs none, and `migrate`
  stops without one.
- A schema change is a new folder in `prisma/migrations/`, written to match the schema. `bin/ci`'s drift check
  fails if they disagree.

## Dependencies and licences

- **Pinned exactly**, at least two weeks old, the lockfile resolved with
  `npm install --package-lock-only --ignore-scripts --before=<two weeks ago>`, inside the toolchain. No BSL,
  BUSL or FSL licences.
- **Node 26.12.1 is the exception** to the two weeks: the user chose it for its security patch (2026-10-22). The
  wallet SDK documents Node 22.12+; the spike proved the proof bench and a wallet sync on 26, about 15% faster
  than on 22.
- **The wallet SDK brings seven GPL-3.0 packages** (`@subsquid/*`, `@substrate/connect*`, `smoldot`). Three
  Midnight WASM packages have no licence field. Running them on this server distributes nothing. Shipping them
  to browsers is SEAL-D9, still open.
- **The Prisma CLI brings** Studio (`elkjs`, EPL-2.0), `mysql2` (whose `seq-queue` has no licence field) and a
  PGlite dev server. These are server-side only. They are why `node_modules` is about 630 MB and the image about
  1.2 GB; a lighter migrator image is possible later.

## Not built yet

- The gRPC server, the mesh certificate and the per-RPC allow list: these come with S1's first RPC in
  `kinetix-contracts` (`seal.v1`).
- The watcher on the indexer's contract actions, and the generations table.
- The registry's deployment, issuance from matching's and review's facts, the verifier page and the holder's
  page: the rest of S1. The contract and its tests exist; nothing deploys it yet.
- The features: S1 credentials, S2 sealed-bid auctions, S3 anonymous reports.
