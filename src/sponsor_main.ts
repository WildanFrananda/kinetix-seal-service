import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import { Registry } from "prom-client"

import type { LoggerPort } from "./application/ports/logger.port.ts"
import Readiness from "./application/readiness.service.ts"
import SponsorMonitor from "./application/sponsor_monitor.service.ts"
import { readSponsorConfig } from "./infrastructure/config/read_sponsor_config.ts"
import { buildHttpServer } from "./infrastructure/http/http_server.ts"
import { loadMeshIdentity } from "./infrastructure/mesh/mesh_identity.ts"
import FacadeSponsorWallet from "./infrastructure/midnight/facade_sponsor_wallet.adapter.ts"
import FacadeTransactionPayer from "./infrastructure/midnight/facade_transaction_payer.adapter.ts"
import { sponsorSecrets } from "./infrastructure/midnight/seal_secrets.ts"
import StartingSponsorWallet from "./infrastructure/midnight/starting_sponsor_wallet.adapter.ts"
import StartingTransactionPayer from "./infrastructure/midnight/starting_transaction_payer.adapter.ts"
import { startWalletFacade } from "./infrastructure/midnight/wallet_facade_factory.ts"
import { deriveWalletKeys } from "./infrastructure/midnight/wallet_keys.ts"
import { loadWalletState, walletStateFile } from "./infrastructure/midnight/wallet_state_file.ts"
import { estateMetrics } from "./infrastructure/observability/estate_metrics.ts"
import JsonLogger from "./infrastructure/observability/json_logger.ts"
import PrometheusSponsorGauges from "./infrastructure/observability/prometheus_sponsor_gauges.adapter.ts"
import { redactOutput } from "./infrastructure/observability/redacting_output.ts"
import { createPrismaClient } from "./infrastructure/postgres/prisma_client.ts"
import PrismaDatabaseProbe from "./infrastructure/postgres/prisma_database_probe.adapter.ts"
import PrismaSponsorEventStore from "./infrastructure/postgres/prisma_sponsor_event_store.adapter.ts"
import { repeat } from "./infrastructure/scheduling/repeat.ts"
import { onTermination } from "./infrastructure/shutdown/on_termination.ts"
import LocalSponsorState from "./infrastructure/sponsor/local_sponsor_state.ts"
import { buildSponsorApi } from "./infrastructure/sponsor/sponsor_api.ts"

const service = "kinetix-seal-sponsor"
const config = readSponsorConfig(process.env)

redactOutput(sponsorSecrets(config))
setNetworkId(config.midnight.networkId)

const logger: LoggerPort = new JsonLogger(service, config.logLevel, (line) => {
  process.stdout.write(line)
})

const registry = new Registry()
const metrics = estateMetrics(registry, service, config.serviceVersion)
const gauges = new PrometheusSponsorGauges(registry)
const prisma = createPrismaClient(config.databaseUrl)
const wallet = new StartingSponsorWallet()
const payer = new StartingTransactionPayer()
const monitor = new SponsorMonitor(
  wallet,
  new PrismaSponsorEventStore(prisma),
  gauges,
  logger,
  config.sponsorThresholds
)
const readiness = new Readiness(new PrismaDatabaseProbe(prisma), monitor)
const server = buildHttpServer({ service, readiness, registry, metrics, logger })
const api = buildSponsorApi({
  identity: loadMeshIdentity(config.mesh),
  state: new LocalSponsorState(monitor, wallet),
  payer,
  logger
})
const stops: Array<() => void> = []

onTermination(
  config.shutdownGraceSeconds,
  async () => {
    logger.info({ message: "draining" })

    for (const stop of stops) {
      stop()
    }

    await api.close()
    await server.close()
    await wallet.checkpoint()
    await wallet.stop()
    await prisma.$disconnect()
  },
  (error) => {
    logger.error({ message: "the shutdown failed" }, error)
  }
)

await server.listen({ host: "0.0.0.0", port: config.httpPort })
await api.listen({ host: "0.0.0.0", port: config.apiPort })
logger.info({
  message: "serving HTTP",
  fields: { port: config.httpPort, api_port: config.apiPort, version: config.serviceVersion }
})

await monitor.resume()

stops.push(
  repeat(config.sponsorMonitorSeconds, async () => {
    await monitor.observe().catch((error: unknown) => {
      logger.error({ message: "the sponsor wallet could not be observed" }, error)
    })
  })
)

const keys = deriveWalletKeys(config.sponsorMnemonic)
const stateFile = walletStateFile(config.walletStateDir, keys)
const saved = await loadWalletState(stateFile)
const restoreStarted = performance.now()

logger.info({
  message: saved === undefined ? "syncing the sponsor wallet from genesis" : "restoring the sponsor wallet"
})

const facade = await startWalletFacade(config.midnight, config.blockfrostProjectId, keys, saved)
const restoreSeconds = (performance.now() - restoreStarted) / 1000

wallet.started(new FacadeSponsorWallet(facade, stateFile))
payer.started(new FacadeTransactionPayer(facade, keys))
gauges.restored(restoreSeconds)
logger.info({ message: "the sponsor wallet started", fields: { restore_seconds: Math.round(restoreSeconds) } })

stops.push(
  repeat(config.walletCheckpointSeconds, async () => {
    await wallet.checkpoint().catch((error: unknown) => {
      logger.error({ message: "the sponsor wallet state could not be saved" }, error)
    })
  })
)
