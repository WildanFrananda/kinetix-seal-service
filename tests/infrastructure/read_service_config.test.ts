import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { readServiceConfig } from "../../src/infrastructure/config/read_service_config.ts"

const complete: NodeJS.ProcessEnv = {
  KINETIX_SEAL_SERVICE_VERSION: "0123abc",
  KINETIX_SEAL_HTTP_PORT: "8012",
  KINETIX_SEAL_LOG_LEVEL: "info",
  KINETIX_SEAL_DATABASE_URL: "postgresql://kinetix_seal_app:secret@kinetix-seal-db:5432/kinetix_seal_dev",
  KINETIX_SEAL_BLOCKFROST_PROJECT_ID: "nightpreprodTEST",
  KINETIX_SEAL_ISSUER_SECRET: "a1".repeat(32),
  KINETIX_SEAL_NETWORK_ID: "preprod",
  KINETIX_SEAL_INDEXER_HTTP_URL: "https://midnight-preprod.blockfrost.io/api/v0",
  KINETIX_SEAL_INDEXER_WS_URL: "wss://midnight-preprod.blockfrost.io/api/v0/ws",
  KINETIX_SEAL_PROOF_SERVER_URL: "http://kinetix-seal-proof-server:6300",
  KINETIX_PKI_DIR: "/pki",
  KINETIX_TRUST_DOMAIN: "kinetix.local, prod.kinetix",
  KINETIX_SEAL_MATCHING_GRPC_ADDR: "kinetix-matching-service:50053",
  KINETIX_SEAL_REVIEW_GRPC_ADDR: "kinetix-review-grpc:50060",
  KINETIX_SEAL_FACTS_TICK_SECONDS: "60",
  KINETIX_SEAL_FEED_TIMEOUT_SECONDS: "30",
  KINETIX_SEAL_FEED_PAGE_SIZE: "500",
  KINETIX_SEAL_FEED_PAGES_PER_TICK: "20",
  KINETIX_SEAL_SPONSOR_URL: "https://kinetix-seal-sponsor:8014",
  KINETIX_SEAL_SPONSOR_POLL_SECONDS: "15",
  KINETIX_SEAL_SPONSOR_TIMEOUT_SECONDS: "5",
  KINETIX_SEAL_REGISTRY_CHECK_SECONDS: "600",
  KINETIX_SEAL_MIDNIGHT_STEP_SECONDS: "300",
  KINETIX_SEAL_SHUTDOWN_GRACE_SECONDS: "25"
}

describe("reading the service's configuration", () => {
  it("reads a complete environment, with no wallet in it", () => {
    const config = readServiceConfig(complete)

    assert.equal(config.httpPort, 8012)
    assert.equal(config.issuerSecret[0], 0xa1)
    assert.deepEqual(config.mesh.trustDomains, ["kinetix.local", "prod.kinetix"])
    assert.equal(config.sponsor.url, "https://kinetix-seal-sponsor:8014")
    assert.ok(!("sponsorMnemonic" in config))
  })

  it("names every missing setting at once", () => {
    const { KINETIX_SEAL_DATABASE_URL: _database, KINETIX_SEAL_SPONSOR_URL: _sponsor, ...rest } = complete

    assert.throws(
      () => readServiceConfig(rest),
      /KINETIX_SEAL_DATABASE_URL is required and has no default; KINETIX_SEAL_SPONSOR_URL is required/
    )
  })

  it("refuses a value it cannot use instead of falling back", () => {
    assert.throws(
      () => readServiceConfig({ ...complete, KINETIX_SEAL_SPONSOR_URL: "http://kinetix-seal-sponsor:8014" }),
      /KINETIX_SEAL_SPONSOR_URL must be a https: URL/
    )
    assert.throws(
      () => readServiceConfig({ ...complete, KINETIX_SEAL_FEED_PAGE_SIZE: "501" }),
      /KINETIX_SEAL_FEED_PAGE_SIZE must be at most 500/
    )
    assert.throws(
      () => readServiceConfig({ ...complete, KINETIX_SEAL_MATCHING_GRPC_ADDR: "https://kinetix-matching-service" }),
      /KINETIX_SEAL_MATCHING_GRPC_ADDR must be host:port/
    )
    assert.throws(
      () => readServiceConfig({ ...complete, KINETIX_TRUST_DOMAIN: " , " }),
      /KINETIX_TRUST_DOMAIN must name at least one value/
    )
  })

  it("refuses an issuer secret that is not 32 bytes of lowercase hex, without printing it", () => {
    for (const secret of ["a1".repeat(31), "A1".repeat(32), "zz".repeat(32)]) {
      assert.throws(
        () => readServiceConfig({ ...complete, KINETIX_SEAL_ISSUER_SECRET: secret }),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes("KINETIX_SEAL_ISSUER_SECRET must be 32 bytes of lowercase hex") &&
          !error.message.includes(secret)
      )
    }
  })

  it("never puts a secret into an error message", () => {
    assert.throws(
      () => readServiceConfig({ ...complete, KINETIX_SEAL_HTTP_PORT: "" }),
      (error: unknown) => error instanceof Error && !error.message.includes("nightpreprodTEST")
    )
  })
})
