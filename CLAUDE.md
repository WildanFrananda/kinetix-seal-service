# kinetix-seal-service

Seal proves facts without revealing the data behind them, with Compact contracts on Midnight Preprod. The
plan, the rulings (SEAL-D1 to D11) and the gates are in `kinetix-infrastructure/docs/SEAL-SERVICE.md`; the
measurements behind them come from the lab harness `kinetix-seal-spike/` at the estate root.

Today it runs, for real:
- the sponsor wallet that pays every DUST fee, in its own process (SEAL-D17);
- the credential registry's generations on Preprod (S1a);
- the courier facts, read from matching and review over the mesh (S1b);
- courier credentials: a courier asks, seal issues a snapshot of their facts into the registry (S1d);
- predicates: an admin approves the minimums a holder may be asked to prove, seal keeps them in the registry (S1e);
- the holder runtime a phone proves with, the registry snapshot it proves against, and the relay a verifier hands
  a presentation to (S1f, SEAL-D9 and D18);
- the public page where anyone checks a courier's credential (S1g).

S1 for couriers ran end to end on production on 2026-11-09, with the courier app at v1.0.0: a real delivery, a
credential issued to the app, and the public page answering Verified. Its exit still owes the reset drill
("Registry generations" below); what remains beyond S1 is in "Not built yet".

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
- **A private member says `private`** (the user, 2026-10-31, *"saya mau nya explicit"*): `private readonly
  wallet`, `private async drainStream()`, never a `#` name. Public members carry no modifier.
  `biome-plugins/no_private_names.grit` refuses `#` in a declaration and in an access. A private member never
  shares its name with a public one; the four that did were renamed (`drainStream`, `reconcileOnce`, `payNow`,
  `delegate`).
- **The house layout's blank lines** (the user's rule, every repository): `scripts/check_layout.ts`, copied from the
  backoffice and run by `bin/ci`, parses every source with `@babel/parser` and refuses a statement cuddled after a
  multi-line one, a check or loop cuddled after a statement it does not read, a cuddled `return` that ends a longer
  block, and a blank line just inside a block's braces. `node scripts/check_layout.ts --fix` inserts or removes the
  blank lines and touches nothing else. An assignment stays cuddled with the check that reads it.
- **English only.**

## Conventions

- **Config fails fast.** Every setting is required, with no default, and each process reads only its own
  (`read_service_config.ts`, `read_sponsor_config.ts`).
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

- **Two processes, one image** (SEAL-D17, 2026-10-31). `node dist/src/main.js` is the service: the API, the fact
  feeds, the registry generations. `node dist/src/sponsor_main.js` is the sponsor, the only process that runs the
  wallet. Each reads its own settings (`read_service_config.ts`, `read_sponsor_config.ts`): the service holds the
  issuer secret and never the seed, the sponsor holds the seed and never the issuer secret.
- **The sponsor stays up across seal's releases.** Production pins it at its own digest
  (`KINETIX_SEAL_SPONSOR_DIGEST`), and it is deployed on purpose, only when the wallet's code changes, as the
  deployable `kinetix-seal-sponsor`. A release of the service takes two or three minutes and leaves the wallet
  alone.
- **The link** (`src/infrastructure/sponsor/`): HTTPS with mutual TLS on 8014, seal's own leaf at both ends. The
  sponsor admits only `spiffe://…/service/seal`; the client accepts only a server whose SPIFFE ID is seal's. The
  leaf names `kinetix-seal-service`, not the sponsor's host, so the link checks the chain and the SPIFFE ID, not
  the hostname. The API is `/v1`, kept backward compatible because the two run different builds:
  - `GET /v1/state`: the condition and the snapshot, the DUST balance in SPECK as a string;
  - `POST /v1/transactions/sponsor` (S1f): `{ "transaction": hex }`, a holder's proven and bound transaction
    (`"binding"`); the sponsor balances it with DUST only and submits it, in the same queue as `pay`. An older
    sponsor answers 404, which the service's relay reports as `SPONSOR_UNAVAILABLE`;
  - `POST /v1/transactions/pay`: `{ "transaction": hex }`, a proven and unbound transaction (the ledger's
    `"signature"`, `"proof"`, `"pre-binding"`); the sponsor adds DUST, signs, finalizes, submits, and answers
    `{ "txId" }`. Spends run one at a time. Confirmation is the caller's, through the indexer. While the wallet
    syncs the answer is 503.
  - Health, readiness and metrics are on 8013, plain HTTP, like every probe in the estate.
- **Readiness.** The service is ready when Postgres answers and the sponsor, polled every
  `KINETIX_SEAL_SPONSOR_POLL_SECONDS`, reports anything but `syncing`; unreachable is not ready. The sponsor is
  ready when its wallet is synced, and keeps the image's 15-minute start period.
- **The sponsor's address**, for the faucet: `node dist/src/cli/sponsor_address.js`, which needs only
  `KINETIX_SEAL_NETWORK_ID` and `KINETIX_SEAL_SPONSOR_MNEMONIC` and starts no wallet.
- **One process per seed, ever.** Two wallet instances on one seed double-spend DUST. The admin commands start
  their own instance, so they run with the sponsor stopped (the service keeps serving):
  `docker compose run --rm --no-deps kinetix-seal-sponsor node dist/src/cli/register_dust.js`, or
  `split_night.js` with `KINETIX_SEAL_SPLIT_OUTPUTS`.
- **A restore takes about ten minutes** (506 s to 562 s on the VPS). The sponsor's HTTP server starts first, so
  `/health` answers and `/health/ready` reads `syncing` until then. A restore is CPU-bound and starves the event
  loop: on 2026-10-31, inside one process, a feed call missed its 30 s deadline at the moment the restore ended.
  That is one more reason the wallet has its own process. A fresh wallet syncs from genesis in about 2 hours
  (3 h 25 min on the VPS, 2026-10-22).
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
- **A drill retires the active generation on purpose.** A healthy chain never replaces a generation, so the plan's
  reset drill (S1's exit) has its own command, `node dist/src/cli/retire_registry.js`, which reads only
  `KINETIX_SEAL_DATABASE_URL` and `KINETIX_SEAL_DRILL_GENERATION`, the generation the operator means to retire. It
  writes one retirement, reason `drill`, through `RegistryDrill`, and refuses a generation that is not the active
  one, a moment with none active (a deploy in flight is left alone), and any network but `preprod`, `preview` and
  `undeployed`: on mainnet a new generation costs real fees and is the owner's decision, not a drill. Everything
  else is the running service's, as after a reset: its next check deploys the next generation, `CredentialIssuer`
  re-issues each courier's current credential there, and `PredicateKeeper` places the live templates' rows. It
  starts no wallet, so it runs with the service up:
  `docker compose run --rm --no-deps -e KINETIX_SEAL_DRILL_GENERATION=<n> kinetix-seal-service node dist/src/cli/retire_registry.js`.
- **The issuer secret** (`KINETIX_SEAL_ISSUER_SECRET`, 32 bytes of lowercase hex, in SOPS, one per environment)
  is redacted from every output. The maintenance authority's signing key is derived from it and the generation
  number, so nothing stores it: every change is a new generation anyway.

### The mesh and the courier facts (S1b)

- **Seal's mesh identity** is `spiffe://kinetix.local/service/seal`, its leaf mounted at `KINETIX_PKI_DIR`
  (`tls.crt`, `tls.key`, `ca.pem`), and the trust domains in `KINETIX_TRUST_DOMAIN`. Both are required, with no
  default; a missing file stops the start.
- **Every client checks its server twice** (`src/infrastructure/grpc/mesh_channel_credentials.ts`): the hostname
  against the leaf's DNS names, then the leaf's single SPIFFE ID against the service seal meant to dial. Owners
  admit seal per RPC by the name `seal`.
- **gRPC is `@grpc/grpc-js` with the contracts' protobuf-es messages**, not proto-loader: `unaryCall` takes the
  method's descriptor from `kinetix-contracts`, so the path, the request and the response types all come from
  the contract. The generated modules are imported from the package as they ship.
- **The feeds** (`CourierFacts`) follow notary's rules: a cursor per stream, moved by compare-and-swap with the
  page's rows in one transaction; every page checked first (`src/domain/feed_page_violation.ts`); unavailable is
  retried next tick, a refusal or a malformed page stops the stream and is logged as an error.
- **Tests mint their own PKI.** `bin/test-pki` runs `step` (pinned in the toolchain image by SHA-256) to make a
  CA, seal's leaf, matching's and review's, an impostor (matching's name, review's SPIFFE ID) and a leaf from
  another CA, into `tests/fixtures/pki/`, which git ignores. `bin/test` runs it first. No key is ever committed.

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

### Courier credentials (S1d)

- **The route** is `POST /api/v1/seal/courier-credentials`, behind the gateway, which forwards the path whole. The
  body is exactly `{ "holderPublicKey": "<decimal>" }`: `holderPublicKey(secret)` of the contract, a field element,
  computed on the holder's device. The secret never leaves the device (SEAL-D16's default). The answer is the
  credential and where it stands: `202` with `Location` for a new one, `200` for a repeat from the same key.
  `GET /api/v1/seal/courier-credentials/{id}` shows it to its holder only; anyone else, and an id that is not a
  lowercase UUID, gets `404`. Errors are `{ error, message, traceId }`: `TOKEN_REFUSED` 401, `IDENTITY_UNAVAILABLE`
  503, `COURIER_REQUIRED` 403, `INVALID_REQUEST` 400, `NO_DELIVERIES` 409, `ISSUED_TODAY` 409, `FACTS_UNAVAILABLE`
  503 with `Retry-After`, `NOT_FOUND` 404. Both routes answer `Cache-Control: no-store`.
- **Seal checks identity's token itself** (`JoseTokenVerifier`, jose 6.2.12, MIT): RS256 only, against
  `IDENTITY_JWKS_URL`, `JWT_ISSUER` and `JWT_AUDIENCE`, the estate's own names, with 30 s of clock skew, and
  `token_use` must be `access`. Kong checks the signature too, but only seal can tell a refresh token from an
  access token. Keys it cannot fetch are `IDENTITY_UNAVAILABLE`, never a refused token. Only the `courier` role
  gets a courier credential; the principal is `sub`, the same id matching's deliveries carry.
- **The credential is a snapshot** of seal's own fact tables, never a call to matching or review at request time:
  the deliveries, the average driver rating in hundredths rounded down (0 when nobody rated the courier), the days
  since the first delivery (SEAL-D14), and the issue day (UTC days since the epoch). The class is
  `kinetix:seal:courier:v1`, padded to 32 bytes, as the contract tests name it. The salt is 32 random bytes.
- **Facts must be current.** `feed_cursors.caught_up_at` is written when a page says there is no more. A request is
  refused `FACTS_UNAVAILABLE` unless both streams caught up within `KINETIX_SEAL_CREDENTIAL_FACTS_MAX_AGE_SECONDS`:
  a feed that is down or behind would otherwise state an old count as today's.
- **One credential per courier, class and day** (a unique key). A repeat with the same holder key returns that
  credential; another key that day is `ISSUED_TODAY`. Older credentials are not revoked: `revoke` resets the tree's
  history for every holder, and a snapshot stays true for its issue day, which predicates bound.
- **Issuance is a queue** (`CredentialIssuer`, every `KINETIX_SEAL_CREDENTIAL_ISSUE_SECONDS`, while the sponsor is
  past `syncing`). `queueCurrent` gives each courier's newest credential a `pending` row in the active generation.
  Rows are settled one at a time, in order, and the tick stops at the first failure:
  1. the row becomes `uncertain`, with its leaf, before anything is submitted;
  2. `issue(leaf)` is proved by the proof server and paid by the sponsor, as the registry's deploy is;
  3. the leaf's index is read back from the registry's state.

  An `uncertain` row is looked up in the registry before it is submitted again, so a timeout that landed is
  recorded, not issued twice. One that did not land is submitted again; if the first one lands later anyway, the
  leaf is in the tree twice, which costs a fee and reveals nothing new.
- **A new generation re-issues** every courier's current credential, with the same leaf (credential, holder key and
  salt are kept), at a new index. The holder reads its new index from the GET; its secret and credential do not
  change. A courier's older credentials are `superseded` there.
- **Leaves are found by recomputing the root.** The registry inserts with `insertHash`, so `findPathForLeaf`, which
  looks for a leaf hash, never finds them. `issuedLeafIndex` builds `pathForLeaf(i, leaf)` from the newest index
  down and compares its root, folded with `transientHash` as the contract's `merkleTreePathRootNoLeafHash` folds it,
  with the current root. A revoked leaf is therefore not found.
- **Logs** name the credential id, the generation and the leaf index, never the principal, the holder key or the
  salt. Metrics: `kinetix_seal_credential_requests_total{outcome}` and
  `kinetix_seal_credential_issuances_total{outcome}`.
- **Not handled yet:** a courier suspended by identity keeps the credentials it has. Identity publishes no standing
  for couriers today (infra `docs/MERCHANT-SUSPENSION.md`, D1–D5 owed).

### Predicates (S1e)

SEAL-D7: anyone may verify, but only against minimums an admin approved. `present` takes a predicate id and the
contract looks the minimums up in its own `predicates` map, so the chain refuses minimums nobody approved (G3,
finding 1); a verifier cannot narrow a holder's values down with arbitrary thresholds.

- **A predicate template** is what an admin approves (`predicate_templates`): a class, a label, a minimum for each
  of the class's first three attributes, and a freshness window in days. Every class's fourth attribute is its
  issue day, so freshness is that attribute's minimum and is derived, never typed in. Bounds are the class's
  (`credential_classes.ts`): for couriers deliveries up to 1,000,000, rating in hundredths up to 500, days active
  up to 36,525; freshness 1 to 365 days; a label of 1 to 80 printable characters. A live duplicate (same class,
  minimums and window) is `PREDICATE_EXISTS`; a class holds at most eight live templates (`TOO_MANY_PREDICATES`).
  The approval takes a transaction-scoped advisory lock, so two admins racing cannot pass either rule.
- **Registry rows come from templates.** Days are grouped into periods of `KINETIX_SEAL_PREDICATE_PERIOD_DAYS`
  counted from day 0. A template's row for a period has the template's three minimums and, fourth, the period's
  first day less the freshness window (never below 0). The current period's row and the previous one are wanted,
  so a presentation started before a rollover still lands; a row's id is the contract's `predicateId`, a hash of
  its content, so one id never means other minimums. With seven-day periods, a presentation under the current row
  proves a credential issued at most freshness + 6 days earlier, under the previous one freshness + 13.
- **The registry is reconciled** (`PredicateKeeper`, every `KINETIX_SEAL_PREDICATE_RECONCILE_SECONDS`, while the
  sponsor is past `syncing`). It reads the active registry's `predicates` map, approves each wanted row the map
  lacks, then withdraws each row it holds that no live template wants, one transaction at a time, stopping at the
  first failure. The chain is the only state: there is no queue and no `uncertain` row, because the next tick
  reads again, and a new generation gets its rows on its first tick. Approving before withdrawing means a
  rollover never leaves a template without a current row. Rows the registry holds are mirrored in
  `predicate_placements` after every reading and change, for the public list.
- **Routes.** `GET /api/v1/seal/predicates` (the live templates, their rows with ids, minimums as decimal strings,
  the minimum issue day and date, which is current and which the registry holds, and the active registry) and
  `GET /api/v1/seal/predicates/{id}` (a withdrawn one too, with no rows) are public, with no token, `Cache-Control:
  public, max-age=60`. `POST /api/v1/seal/predicates` with `{ "class": "courier", "label": …, "minimums": {
  "deliveries": …, "ratingHundredths": …, "daysActive": … }, "freshnessDays": … }` answers `201` with `Location`;
  `DELETE /api/v1/seal/predicates/{id}` answers `204`, a repeat too. Both need role `admin` (`ADMIN_REQUIRED`
  403), which identity issues only after two factors, and the gateway serves them on the staff network only.
  Errors as in S1d, plus `PREDICATE_EXISTS` and `TOO_MANY_PREDICATES` (409) and `NOT_FOUND` (404).
- **Withdrawal** stops new presentations under the template's rows at the next reconcile; what was proven under
  them stays readable in `presentations`.
- **Logs** name the template and the admin for each approval and withdrawal, and the generation, predicate id and
  transaction for each registry change. Metrics: `kinetix_seal_predicate_changes_total{change,outcome}` and
  `kinetix_seal_predicate_drift`, the rows still to approve or withdraw at the last reconcile.
- The registry adapter (`MidnightCredentialChain`) serves both the issuer and the keeper; each circuit call reads
  the registry's state, builds the call, and goes through the same prove, pay and confirm path.

### The holder runtime and the relay (S1f)

SEAL-D9: no GPL code ships to a holder. SEAL-D18: the verifier, not the holder's phone, hands a presentation to
seal, so at presentation time seal sees the verifier's address and never the holder's.

- **The runtime is `holder/`**, TypeScript for a browser: the courier app's hidden WebView loads its page and calls
  `sealHolder.prepare(id)`, `sealHolder.holderPublicKey(id, secretHex)` and `sealHolder.present(id, requestJson)`;
  every answer is a JSON string posted to the app's `SealHolderBridge` channel as `{ id, ok, … }`, never thrown.
  `present` takes the registry snapshot, the holder secret, the credential as seal's GET returned it, the leaf
  index, the verifier's challenge and a predicate row id, builds the call with midnight-js, proves it with the WASM
  prover and answers the bound transaction in hex. The network id comes with the snapshot, because it is written
  into the transaction. The proof runs on the page's thread: the WebView is hidden and its screens are Flutter's,
  so nothing waits on it.
- **The bundle** (`scripts/build_holder.ts`, esbuild, run by `bin/ci` and the image build) is
  `dist/holder-bundle/<sha256 of its files>/`: `index.html`, `holder.js`, the three WASM files, `present`'s
  prover key, verifier key and IR, and `bls_midnight_2p12` (from `MIDNIGHT_PP`), about 7 MB compressed. Two esbuild
  plugins do what a WASM-aware bundler would: `wasm-bindgen-loader` gives each Midnight WASM package a loader that
  streams its `.wasm` and passes the snippet modules its imports name, and `hex-only-address-format` replaces
  `@midnight-ntwrk/wallet-sdk-address-format`, the only way GPL code (`@subsquid/*`) entered, with a module that
  throws on bech32: midnight-js returns hex keys before reaching it, and the holder passes hex only. The build
  refuses any GPL, AGPL, LGPL, SSPL, BSL, BUSL or FSL package, or one without a licence, except the three WASM
  packages, Apache-2.0 at `midnightntwrk/midnight-ledger`; `THIRD_PARTY_NOTICES.txt` carries every licence.
  `tests/holder/holder_bundle.test.ts` runs the built bundle itself in Node and proves a presentation with it.
  In the image, the `contracts` stage copies the parameters out of its BuildKit cache mount into its own output,
  and the build stage takes them from there: a CI runner restores the stage's layers from cache without running
  `compactc`, so the cache mount is empty there (CI failed that way on 2026-11-03).
- **Seal serves it** at `GET /api/v1/seal/holder` (the current build, `no-cache`) and
  `GET /api/v1/seal/holder/{digest}/{file}` (immutable for a year; the page with a CSP that allows only its own
  scripts, `wasm-unsafe-eval` and its own origin). The service refuses to start without a build.
- **The registry snapshot**, `GET /api/v1/seal/registry/snapshot`, is the active registry's contract state, Zswap
  state and ledger parameters in hex, read through the indexer at most once a minute and cacheable for a minute;
  `503 REGISTRY_UNAVAILABLE` while none can be read. The app fetches it on its own schedule, never while
  presenting: a proof against an older root still lands, because the contract keeps the root history until a
  revocation resets it.
- **The relay**, `POST /api/v1/seal/presentations` with `{ "transaction": "<hex>" }`, takes no token: anyone may
  relay, and a verifier with its own server relays the same way. Before the sponsor spends, the transaction must
  deserialize as proven and bound, hold exactly one call, `present`, to the active registry, and move no coins
  (`presentation_shape.ts`); otherwise `422 NOT_A_PRESENTATION`. The sponsor's new
  `POST /v1/transactions/sponsor` balances it with DUST only (`balanceFinalizedTransaction`, as in the official
  sponsoring guide), in the same queue as seal's own spends, so it can neither change the call nor see a secret.
  `202 { txId }`; `503 SPONSOR_UNAVAILABLE` or `REGISTRY_UNAVAILABLE` with `Retry-After: 30`. Neither the route
  nor its logs record an address; the gateway limits it to 20 a minute per address.
- **The presentation protocol** (SEAL-D18), which the courier app speaks and the verifier page (S1g) must speak
  exactly:
  - the verifier's request is a QR code `kinetix-seal:present?v=1&r=<registry address>&p=<predicate row id>&c=<challenge, 32 bytes hex>&a=<answer URL, https>`;
  - in person, the holder's answer is a cycle of QR frames `KSP1:<first 8 hex of the transaction's SHA-256>:<i>/<n>:<chunk>`,
    the chunks being 600 characters of the transaction's unpadded base64url, every 250 ms;
  - remotely, it is the link `<answer URL>#<challenge>.<unpadded base64url transaction>`, the fragment never
    reaching a server; the challenge lets the verifier's page match the answer to a request it made;
  - the verifier rebuilds the transaction, hex-encodes it and posts `{ transaction }` to the relay, then reads
    `GET /api/v1/seal/presentations/{challenge}` until the registry records it.
- **Not checked before paying:** whether the challenge was already answered or the predicate row is still placed;
  a transaction that fails on chain costs its fee. The verifier page reads both first (S1g).
- Metrics: `kinetix_seal_presentations_relayed_total{outcome}`.

### The verifier page (S1g)

Anyone checks a courier's credential at `GET /api/v1/seal/verify` on the API host, a page seal serves (the user
chose seal over the docs site on 2026-11-03: the docs site has no CORS to the API and refuses the camera, and seal
already serves the holder's page). No account and no token.

- **The bundle** is `verifier/` (plain TypeScript and the DOM, no framework), built by `scripts/build_verifier.ts`
  into `dist/verifier-bundle/<sha256>/` (`verifier.js`, `verifier.css`, `THIRD_PARTY_NOTICES.txt`) under the same
  licence gate as the holder's. It bundles `qrcode-generator` (MIT) and `jsqr` (Apache-2.0). The page itself is
  written by `verifier_routes.ts`, `no-cache`, its script and style under `/api/v1/seal/verify/assets/<digest>/`,
  immutable; its CSP allows only seal's own origin, and `Permissions-Policy` allows the camera on this page only.
- **The flow.** The page lists the approved predicates whose current row the registry holds; the verifier picks one,
  and the page makes a challenge in the browser, keeps it in `localStorage` for two hours (twenty at most), and shows
  the request QR (the protocol above, `a` = the page's own address). In person it reads the courier's cycling frames
  with the camera (`BarcodeDetector` where the browser has it, `jsqr` otherwise); remotely the courier's link opens
  the same page, which reads the fragment and clears it from the address bar. Either way the page asks
  `GET /api/v1/seal/presentations/{challenge}` first, relays the transaction only if the challenge is unanswered,
  then asks every five seconds for three minutes.
- **The verdict** is what the registry recorded for the challenge, described from the public predicate list:
  "Verified: <label>" with the minimums. An answer to a challenge this browser never made is shown with the warning
  that it cannot tell whether it was meant for this verifier; an answer under another predicate than the one asked is
  refused. An unreachable registry reads "not confirmed yet", never "invalid".
- **`GET /api/v1/seal/presentations/{challenge}`** answers `{ status: "answered" | "unanswered", predicateId,
  generation }` from the active registry's `presentations` map, read at most every five seconds however many pages
  wait (`PresentationStatuses`), `503 REGISTRY_UNAVAILABLE` when it cannot be read. The gateway serves it on its own
  route at the usual 100 a minute, apart from the relay's 20.
- **Checked in a browser** on 2026-11-03: headless Chrome against a local harness serving the real bundle under the
  page's CSP rendered the predicate list, and a link answer was relayed, polled and shown as verified, with no console
  error. The camera path was not exercised headless.

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
- **Dependabot** (`.github/dependabot.yml`) opens its pull requests against `development`, like every
  repository in the estate. It carries no comments, so its reasons are here:
  - **A 14-day cooldown** on npm, the contracts' npm and GitHub Actions is the two-week rule, enforced. Security
    updates are not delayed by it.
  - **`@midnight-ntwrk/compact-runtime` is never updated by Dependabot.** It must be the runtime of the pinned
    compiler: the compiled contract calls `checkRuntimeVersion('0.16.0')` and refuses any other.
  - **No Midnight major** (`@midnight-ntwrk/*`, `@midnightntwrk/*`): midnight-js 5 and wallet SDK 2 are ledger 9.
    The Midnight packages move together in one group, as they must.
  - **`@openzeppelin/compact-contracts` stays below 0.4**, which targets ledger 9.
  - Ledger 9 is one deliberate move, a new contract generation: infra `docs/MIGRATIONS.md` M12.
  - Base images and the toolchain's Postgres take no major; the toolchain's own image is built here, not
    pulled, so it is ignored. `@types/node` takes no major while the runtime is Node 26.
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

- A gRPC server of seal's own: nothing calls seal over the mesh yet.
- S1 for merchants (after payment's revenue feed, SEAL-D6), S2 sealed-bid auctions, S3 anonymous reports.
