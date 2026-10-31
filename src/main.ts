import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider"
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider"
import { Registry } from "prom-client"
import CourierFacts from "./application/courier_facts.service.ts"
import type { LoggerPort } from "./application/ports/logger.port.ts"
import Readiness from "./application/readiness.service.ts"
import RegistryGenerations from "./application/registry_generations.service.ts"
import SponsorMonitor from "./application/sponsor_monitor.service.ts"
import { readSealConfig } from "./infrastructure/config/read_seal_config.ts"
import GrpcDeliveryFeed from "./infrastructure/grpc/grpc_delivery_feed.adapter.ts"
import GrpcReviewFeed from "./infrastructure/grpc/grpc_review_feed.adapter.ts"
import { loadMeshIdentity } from "./infrastructure/grpc/mesh_identity.ts"
import { buildHttpServer } from "./infrastructure/http/http_server.ts"
import { withProjectId } from "./infrastructure/midnight/blockfrost_url.ts"
import { contractBuildDigest } from "./infrastructure/midnight/contract_build_digest.ts"
import { credentialRegistryDirectory } from "./infrastructure/midnight/credential_registry_contract.ts"
import FacadeSponsorWallet from "./infrastructure/midnight/facade_sponsor_wallet.adapter.ts"
import IndexerBlocks from "./infrastructure/midnight/indexer_blocks.ts"
import MidnightRegistryChain from "./infrastructure/midnight/midnight_registry_chain.adapter.ts"
import { sealSecrets } from "./infrastructure/midnight/seal_secrets.ts"
import StartingSponsorWallet from "./infrastructure/midnight/starting_sponsor_wallet.adapter.ts"
import { startWalletFacade } from "./infrastructure/midnight/wallet_facade_factory.ts"
import { deriveWalletKeys } from "./infrastructure/midnight/wallet_keys.ts"
import { loadWalletState, walletStateFile } from "./infrastructure/midnight/wallet_state_file.ts"
import { estateMetrics } from "./infrastructure/observability/estate_metrics.ts"
import JsonLogger from "./infrastructure/observability/json_logger.ts"
import PrometheusFeedMetrics from "./infrastructure/observability/prometheus_feed_metrics.adapter.ts"
import PrometheusRegistryGauges from "./infrastructure/observability/prometheus_registry_gauges.adapter.ts"
import PrometheusSponsorGauges from "./infrastructure/observability/prometheus_sponsor_gauges.adapter.ts"
import { redactOutput } from "./infrastructure/observability/redacting_output.ts"
import { createPrismaClient } from "./infrastructure/postgres/prisma_client.ts"
import PrismaCourierFactStore from "./infrastructure/postgres/prisma_courier_fact_store.adapter.ts"
import PrismaDatabaseProbe from "./infrastructure/postgres/prisma_database_probe.adapter.ts"
import PrismaRegistryGenerationStore from "./infrastructure/postgres/prisma_registry_generation_store.adapter.ts"
import PrismaSponsorEventStore from "./infrastructure/postgres/prisma_sponsor_event_store.adapter.ts"
import { repeat } from "./infrastructure/scheduling/repeat.ts"
import { onTermination } from "./infrastructure/shutdown/on_termination.ts"

const service = "kinetix-seal-service"
const config = readSealConfig(process.env)

redactOutput(sealSecrets(config))
setNetworkId(config.midnight.networkId)

const logger: LoggerPort = new JsonLogger(service, config.logLevel, (line) => {
  process.stdout.write(line)
})

const registry = new Registry()
const metrics = estateMetrics(registry, service, config.serviceVersion)
const gauges = new PrometheusSponsorGauges(registry)
const registryGauges = new PrometheusRegistryGauges(registry)
const prisma = createPrismaClient(config.databaseUrl)
const meshIdentity = loadMeshIdentity(config.mesh)
const deliveryFeed = new GrpcDeliveryFeed(config.facts.matchingAddress, meshIdentity, config.facts.callTimeoutSeconds)
const reviewFeed = new GrpcReviewFeed(config.facts.reviewAddress, meshIdentity, config.facts.callTimeoutSeconds)
const courierFacts = new CourierFacts(
  deliveryFeed,
  reviewFeed,
  new PrismaCourierFactStore(prisma),
  new PrometheusFeedMetrics(registry),
  logger,
  { pageSize: config.facts.pageSize, pagesPerTick: config.facts.pagesPerTick }
)
const wallet = new StartingSponsorWallet()
const monitor = new SponsorMonitor(
  wallet,
  new PrismaSponsorEventStore(prisma),
  gauges,
  logger,
  config.sponsorThresholds
)
const readiness = new Readiness(new PrismaDatabaseProbe(prisma), monitor)
const server = buildHttpServer({ service, readiness, registry, metrics, logger })
const stops: Array<() => void> = []

onTermination(
  config.shutdownGraceSeconds,
  async () => {
    logger.info({ message: "draining" })

    for (const stop of stops) {
      stop()
    }

    await server.close()
    deliveryFeed.close()
    reviewFeed.close()
    await wallet.checkpoint()
    await wallet.stop()
    await prisma.$disconnect()
  },
  (error) => {
    logger.error({ message: "the shutdown failed" }, error)
  }
)

await server.listen({ host: "0.0.0.0", port: config.httpPort })
logger.info({ message: "serving HTTP", fields: { port: config.httpPort, version: config.serviceVersion } })

await monitor.resume()

stops.push(
  repeat(config.facts.tickSeconds, async () => {
    await courierFacts.drain().catch((error: unknown) => {
      logger.error({ message: "the courier facts could not be read" }, error)
    })
  })
)

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
gauges.restored(restoreSeconds)
logger.info({ message: "the sponsor wallet started", fields: { restore_seconds: Math.round(restoreSeconds) } })

stops.push(
  repeat(config.walletCheckpointSeconds, async () => {
    await wallet.checkpoint().catch((error: unknown) => {
      logger.error({ message: "the sponsor wallet state could not be saved" }, error)
    })
  })
)

const zkConfig = new NodeZkConfigProvider<string>(credentialRegistryDirectory)
const registryGenerations = new RegistryGenerations(
  new MidnightRegistryChain({
    wallet: facade,
    keys,
    publicData: indexerPublicDataProvider(
      withProjectId(config.midnight.indexerHttpUrl, config.blockfrostProjectId),
      withProjectId(config.midnight.indexerWsUrl, config.blockfrostProjectId)
    ),
    proofs: httpClientProofProvider(config.midnight.proofServerUrl, zkConfig),
    zkConfig,
    blocks: new IndexerBlocks(config.midnight.indexerHttpUrl, config.blockfrostProjectId, config.midnightStepSeconds),
    issuerSecret: config.issuerSecret,
    networkStepSeconds: config.midnightStepSeconds
  }),
  new PrismaRegistryGenerationStore(prisma),
  registryGauges,
  logger,
  config.midnight.networkId,
  await contractBuildDigest(credentialRegistryDirectory)
)

stops.push(
  repeat(config.registryCheckSeconds, async () => {
    if (monitor.condition() === "syncing") {
      return
    }

    await registryGenerations.reconcile().catch((error: unknown) => {
      logger.error({ message: "the credential registry could not be reconciled" }, error)
    })
  })
)
