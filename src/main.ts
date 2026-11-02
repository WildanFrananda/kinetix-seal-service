import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider"
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider"
import { Registry } from "prom-client"

import CourierCredentials from "./application/courier_credentials.service.ts"
import CourierFacts from "./application/courier_facts.service.ts"
import CredentialIssuer from "./application/credential_issuer.service.ts"
import type { LoggerPort } from "./application/ports/logger.port.ts"
import Readiness from "./application/readiness.service.ts"
import RegistryGenerations from "./application/registry_generations.service.ts"
import RemoteSponsorStatus from "./application/remote_sponsor_status.service.ts"
import { readServiceConfig } from "./infrastructure/config/read_service_config.ts"
import GrpcDeliveryFeed from "./infrastructure/grpc/grpc_delivery_feed.adapter.ts"
import GrpcReviewFeed from "./infrastructure/grpc/grpc_review_feed.adapter.ts"
import { registerCredentialRoutes } from "./infrastructure/http/credential_routes.ts"
import { buildHttpServer } from "./infrastructure/http/http_server.ts"
import JoseTokenVerifier from "./infrastructure/identity/jose_token_verifier.adapter.ts"
import { loadMeshIdentity } from "./infrastructure/mesh/mesh_identity.ts"
import { withProjectId } from "./infrastructure/midnight/blockfrost_url.ts"
import { contractBuildDigest } from "./infrastructure/midnight/contract_build_digest.ts"
import { credentialRegistryDirectory } from "./infrastructure/midnight/credential_registry_contract.ts"
import IndexerBlocks from "./infrastructure/midnight/indexer_blocks.ts"
import MidnightCredentialChain from "./infrastructure/midnight/midnight_credential_chain.adapter.ts"
import MidnightRegistryChain from "./infrastructure/midnight/midnight_registry_chain.adapter.ts"
import { serviceSecrets } from "./infrastructure/midnight/seal_secrets.ts"
import { estateMetrics } from "./infrastructure/observability/estate_metrics.ts"
import JsonLogger from "./infrastructure/observability/json_logger.ts"
import PrometheusCredentialMetrics from "./infrastructure/observability/prometheus_credential_metrics.adapter.ts"
import PrometheusFeedMetrics from "./infrastructure/observability/prometheus_feed_metrics.adapter.ts"
import PrometheusRegistryGauges from "./infrastructure/observability/prometheus_registry_gauges.adapter.ts"
import { redactOutput } from "./infrastructure/observability/redacting_output.ts"
import { createPrismaClient } from "./infrastructure/postgres/prisma_client.ts"
import PrismaCourierFactStore from "./infrastructure/postgres/prisma_courier_fact_store.adapter.ts"
import PrismaCredentialStore from "./infrastructure/postgres/prisma_credential_store.adapter.ts"
import PrismaDatabaseProbe from "./infrastructure/postgres/prisma_database_probe.adapter.ts"
import PrismaRegistryGenerationStore from "./infrastructure/postgres/prisma_registry_generation_store.adapter.ts"
import { repeat } from "./infrastructure/scheduling/repeat.ts"
import { onTermination } from "./infrastructure/shutdown/on_termination.ts"
import HttpsSponsorClient from "./infrastructure/sponsor/https_sponsor_client.ts"

function now(): Date {
  return new Date()
}

const service = "kinetix-seal-service"
const config = readServiceConfig(process.env)

redactOutput(serviceSecrets(config))
setNetworkId(config.midnight.networkId)

const logger: LoggerPort = new JsonLogger(service, config.logLevel, (line) => {
  process.stdout.write(line)
})

const registry = new Registry()
const metrics = estateMetrics(registry, service, config.serviceVersion)
const registryGauges = new PrometheusRegistryGauges(registry)
const prisma = createPrismaClient(config.databaseUrl)
const meshIdentity = loadMeshIdentity(config.mesh)
const deliveryFeed = new GrpcDeliveryFeed(config.facts.matchingAddress, meshIdentity, config.facts.callTimeoutSeconds)
const reviewFeed = new GrpcReviewFeed(config.facts.reviewAddress, meshIdentity, config.facts.callTimeoutSeconds)
const courierFactStore = new PrismaCourierFactStore(prisma)
const courierFacts = new CourierFacts(
  deliveryFeed,
  reviewFeed,
  courierFactStore,
  new PrometheusFeedMetrics(registry),
  logger,
  { pageSize: config.facts.pageSize, pagesPerTick: config.facts.pagesPerTick }
)
const sponsor = new HttpsSponsorClient(
  config.sponsor.url,
  meshIdentity,
  config.sponsor.timeoutSeconds,
  config.midnightStepSeconds
)
const sponsorStatus = new RemoteSponsorStatus(sponsor, logger)
const readiness = new Readiness(new PrismaDatabaseProbe(prisma), sponsorStatus)
const zkConfig = new NodeZkConfigProvider<string>(credentialRegistryDirectory)
const publicData = indexerPublicDataProvider(
  withProjectId(config.midnight.indexerHttpUrl, config.blockfrostProjectId),
  withProjectId(config.midnight.indexerWsUrl, config.blockfrostProjectId)
)
const proofs = httpClientProofProvider(config.midnight.proofServerUrl, zkConfig)
const generationStore = new PrismaRegistryGenerationStore(prisma)
const credentialStore = new PrismaCredentialStore(prisma)
const credentialMetrics = new PrometheusCredentialMetrics(registry)
const registryGenerations = new RegistryGenerations(
  new MidnightRegistryChain({
    payer: sponsor,
    publicData,
    proofs,
    zkConfig,
    blocks: new IndexerBlocks(config.midnight.indexerHttpUrl, config.blockfrostProjectId, config.midnightStepSeconds),
    issuerSecret: config.issuerSecret,
    networkStepSeconds: config.midnightStepSeconds
  }),
  generationStore,
  registryGauges,
  logger,
  config.midnight.networkId,
  await contractBuildDigest(credentialRegistryDirectory)
)
const credentialIssuer = new CredentialIssuer(
  new MidnightCredentialChain({
    payer: sponsor,
    publicData,
    proofs,
    zkConfig,
    issuerSecret: config.issuerSecret,
    networkStepSeconds: config.midnightStepSeconds
  }),
  credentialStore,
  generationStore,
  credentialMetrics,
  logger,
  now
)
const server = buildHttpServer({ service, readiness, registry, metrics, logger })

registerCredentialRoutes(server, {
  credentials: new CourierCredentials(
    courierFactStore,
    credentialStore,
    generationStore,
    credentialMetrics,
    config.credentials.factsMaxAgeSeconds
  ),
  tokens: new JoseTokenVerifier(config.identity),
  logger,
  metrics,
  clock: now
})
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
    sponsor.close()
    await prisma.$disconnect()
  },
  (error) => {
    logger.error({ message: "the shutdown failed" }, error)
  }
)

await server.listen({ host: "0.0.0.0", port: config.httpPort })
logger.info({ message: "serving HTTP", fields: { port: config.httpPort, version: config.serviceVersion } })

await sponsorStatus.refresh()

stops.push(
  repeat(config.sponsor.pollSeconds, async () => {
    await sponsorStatus.refresh()
  })
)

stops.push(
  repeat(config.facts.tickSeconds, async () => {
    await courierFacts.drain().catch((error: unknown) => {
      logger.error({ message: "the courier facts could not be read" }, error)
    })
  })
)

stops.push(
  repeat(config.registryCheckSeconds, async () => {
    const condition = sponsorStatus.condition()

    if (condition === "syncing" || condition === "unreachable") {
      return
    }

    await registryGenerations.reconcile().catch((error: unknown) => {
      logger.error({ message: "the credential registry could not be reconciled" }, error)
    })
  })
)

stops.push(
  repeat(config.credentials.issueSeconds, async () => {
    const condition = sponsorStatus.condition()

    if (condition === "syncing" || condition === "unreachable") {
      return
    }

    await credentialIssuer.settle().catch((error: unknown) => {
      logger.error({ message: "the credential queue could not be settled" }, error)
    })
  })
)
