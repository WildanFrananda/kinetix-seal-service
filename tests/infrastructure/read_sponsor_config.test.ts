import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { readSponsorConfig } from "../../src/infrastructure/config/read_sponsor_config.ts"

const complete: NodeJS.ProcessEnv = {
  KINETIX_SEAL_SERVICE_VERSION: "0123abc",
  KINETIX_SEAL_HTTP_PORT: "8013",
  KINETIX_SEAL_SPONSOR_API_PORT: "8014",
  KINETIX_SEAL_LOG_LEVEL: "info",
  KINETIX_SEAL_DATABASE_URL: "postgresql://kinetix_seal_app:secret@kinetix-seal-db:5432/kinetix_seal_dev",
  KINETIX_SEAL_BLOCKFROST_PROJECT_ID: "nightpreprodTEST",
  KINETIX_SEAL_SPONSOR_MNEMONIC: "  Word  word\tword ",
  KINETIX_SEAL_NETWORK_ID: "preprod",
  KINETIX_SEAL_INDEXER_HTTP_URL: "https://midnight-preprod.blockfrost.io/api/v0",
  KINETIX_SEAL_INDEXER_WS_URL: "wss://midnight-preprod.blockfrost.io/api/v0/ws",
  KINETIX_SEAL_NODE_WS_URL: "wss://rpc.midnight-preprod.blockfrost.io",
  KINETIX_SEAL_PROOF_SERVER_URL: "http://kinetix-seal-proof-server:6300",
  KINETIX_PKI_DIR: "/pki",
  KINETIX_TRUST_DOMAIN: "kinetix.local",
  KINETIX_SEAL_WALLET_STATE_DIR: "/var/lib/seal/wallet",
  KINETIX_SEAL_SPONSOR_MONITOR_SECONDS: "30",
  KINETIX_SEAL_WALLET_CHECKPOINT_SECONDS: "600",
  KINETIX_SEAL_SHUTDOWN_GRACE_SECONDS: "25",
  KINETIX_SEAL_SPONSOR_MIN_DUST_COINS: "3",
  KINETIX_SEAL_SPONSOR_MIN_DUST: "100"
}

describe("reading the sponsor's configuration", () => {
  it("reads a complete environment, with no issuer secret in it", () => {
    const config = readSponsorConfig(complete)

    assert.equal(config.apiPort, 8014)
    assert.equal(config.sponsorMnemonic, "word word word")
    assert.equal(config.sponsorThresholds.minimumDust, 100n * 1_000_000_000_000_000n)
    assert.equal(config.midnight.nodeWsUrl, "wss://rpc.midnight-preprod.blockfrost.io")
    assert.ok(!("issuerSecret" in config))
  })

  it("names every missing setting at once", () => {
    const { KINETIX_SEAL_SPONSOR_API_PORT: _port, KINETIX_SEAL_SPONSOR_MNEMONIC: _mnemonic, ...rest } = complete

    assert.throws(
      () => readSponsorConfig(rest),
      /KINETIX_SEAL_SPONSOR_API_PORT is required and has no default; KINETIX_SEAL_SPONSOR_MNEMONIC is required/
    )
  })

  it("refuses a value it cannot use instead of falling back", () => {
    assert.throws(
      () => readSponsorConfig({ ...complete, KINETIX_SEAL_HTTP_PORT: "80a" }),
      /KINETIX_SEAL_HTTP_PORT must be a positive integer/
    )
    assert.throws(
      () => readSponsorConfig({ ...complete, KINETIX_SEAL_NODE_WS_URL: "http://rpc.midnight-preprod.blockfrost.io" }),
      /KINETIX_SEAL_NODE_WS_URL must be a wss: URL/
    )
  })

  it("never puts a secret into an error message", () => {
    assert.throws(
      () => readSponsorConfig({ ...complete, KINETIX_SEAL_HTTP_PORT: "" }),
      (error: unknown) =>
        error instanceof Error && !error.message.includes("nightpreprodTEST") && !error.message.includes("word word")
    )
  })
})
