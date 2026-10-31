import type { ServiceConfig } from "../../types/service_config.type.ts"
import { logLevels } from "./log_levels.ts"
import SettingReader from "./setting_reader.ts"

function readServiceConfig(env: NodeJS.ProcessEnv): ServiceConfig {
  const read = new SettingReader(env)

  const config: ServiceConfig = {
    serviceVersion: read.text("KINETIX_SEAL_SERVICE_VERSION"),
    httpPort: read.positiveInteger("KINETIX_SEAL_HTTP_PORT"),
    logLevel: read.oneOf("KINETIX_SEAL_LOG_LEVEL", logLevels),
    databaseUrl: read.url("KINETIX_SEAL_DATABASE_URL", ["postgresql:", "postgres:"]),
    blockfrostProjectId: read.text("KINETIX_SEAL_BLOCKFROST_PROJECT_ID"),
    issuerSecret: read.hexBytes("KINETIX_SEAL_ISSUER_SECRET", 32),
    midnight: {
      networkId: read.text("KINETIX_SEAL_NETWORK_ID"),
      indexerHttpUrl: read.url("KINETIX_SEAL_INDEXER_HTTP_URL", ["https:"]),
      indexerWsUrl: read.url("KINETIX_SEAL_INDEXER_WS_URL", ["wss:"]),
      proofServerUrl: read.url("KINETIX_SEAL_PROOF_SERVER_URL", ["http:", "https:"])
    },
    mesh: {
      pkiDirectory: read.text("KINETIX_PKI_DIR"),
      trustDomains: read.list("KINETIX_TRUST_DOMAIN")
    },
    facts: {
      matchingAddress: read.address("KINETIX_SEAL_MATCHING_GRPC_ADDR"),
      reviewAddress: read.address("KINETIX_SEAL_REVIEW_GRPC_ADDR"),
      tickSeconds: read.positiveInteger("KINETIX_SEAL_FACTS_TICK_SECONDS"),
      callTimeoutSeconds: read.positiveInteger("KINETIX_SEAL_FEED_TIMEOUT_SECONDS"),
      pageSize: read.positiveIntegerAtMost("KINETIX_SEAL_FEED_PAGE_SIZE", 500),
      pagesPerTick: read.positiveInteger("KINETIX_SEAL_FEED_PAGES_PER_TICK")
    },
    sponsor: {
      url: read.url("KINETIX_SEAL_SPONSOR_URL", ["https:"]),
      pollSeconds: read.positiveInteger("KINETIX_SEAL_SPONSOR_POLL_SECONDS"),
      timeoutSeconds: read.positiveInteger("KINETIX_SEAL_SPONSOR_TIMEOUT_SECONDS")
    },
    registryCheckSeconds: read.positiveInteger("KINETIX_SEAL_REGISTRY_CHECK_SECONDS"),
    midnightStepSeconds: read.positiveInteger("KINETIX_SEAL_MIDNIGHT_STEP_SECONDS"),
    shutdownGraceSeconds: read.positiveInteger("KINETIX_SEAL_SHUTDOWN_GRACE_SECONDS")
  }

  read.verify()

  return config
}

export { readServiceConfig }
