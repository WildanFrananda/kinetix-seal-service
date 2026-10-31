import type { SponsorConfig } from "../../types/sponsor_config.type.ts"
import { logLevels } from "./log_levels.ts"
import SettingReader from "./setting_reader.ts"

const speckPerDust = 1_000_000_000_000_000n

function readSponsorConfig(env: NodeJS.ProcessEnv): SponsorConfig {
  const read = new SettingReader(env)

  const config: SponsorConfig = {
    serviceVersion: read.text("KINETIX_SEAL_SERVICE_VERSION"),
    httpPort: read.positiveInteger("KINETIX_SEAL_HTTP_PORT"),
    apiPort: read.positiveInteger("KINETIX_SEAL_SPONSOR_API_PORT"),
    logLevel: read.oneOf("KINETIX_SEAL_LOG_LEVEL", logLevels),
    databaseUrl: read.url("KINETIX_SEAL_DATABASE_URL", ["postgresql:", "postgres:"]),
    blockfrostProjectId: read.text("KINETIX_SEAL_BLOCKFROST_PROJECT_ID"),
    sponsorMnemonic: read.text("KINETIX_SEAL_SPONSOR_MNEMONIC").toLowerCase().split(/\s+/).join(" "),
    midnight: {
      networkId: read.text("KINETIX_SEAL_NETWORK_ID"),
      indexerHttpUrl: read.url("KINETIX_SEAL_INDEXER_HTTP_URL", ["https:"]),
      indexerWsUrl: read.url("KINETIX_SEAL_INDEXER_WS_URL", ["wss:"]),
      nodeWsUrl: read.url("KINETIX_SEAL_NODE_WS_URL", ["wss:"]),
      proofServerUrl: read.url("KINETIX_SEAL_PROOF_SERVER_URL", ["http:", "https:"])
    },
    mesh: {
      pkiDirectory: read.text("KINETIX_PKI_DIR"),
      trustDomains: read.list("KINETIX_TRUST_DOMAIN")
    },
    walletStateDir: read.text("KINETIX_SEAL_WALLET_STATE_DIR"),
    sponsorMonitorSeconds: read.positiveInteger("KINETIX_SEAL_SPONSOR_MONITOR_SECONDS"),
    walletCheckpointSeconds: read.positiveInteger("KINETIX_SEAL_WALLET_CHECKPOINT_SECONDS"),
    shutdownGraceSeconds: read.positiveInteger("KINETIX_SEAL_SHUTDOWN_GRACE_SECONDS"),
    sponsorThresholds: {
      minimumDustCoins: read.positiveInteger("KINETIX_SEAL_SPONSOR_MIN_DUST_COINS"),
      minimumDust: BigInt(read.positiveInteger("KINETIX_SEAL_SPONSOR_MIN_DUST")) * speckPerDust
    }
  }

  read.verify()

  return config
}

export { readSponsorConfig }
