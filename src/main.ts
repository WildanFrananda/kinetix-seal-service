import { fileURLToPath } from "node:url"
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider"
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider"
import { Registry } from "prom-client"

import CourierCredentials from "./application/courier_credentials.service.ts"
import CourierFacts from "./application/courier_facts.service.ts"
import CredentialIssuer from "./application/credential_issuer.service.ts"
import type { LoggerPort } from "./application/ports/logger.port.ts"
import PredicateCatalogue from "./application/predicate_catalogue.service.ts"
import PredicateKeeper from "./application/predicate_keeper.service.ts"
import PresentationRelay from "./application/presentation_relay.service.ts"
import PresentationStatuses from "./application/presentation_statuses.service.ts"
import Readiness from "./application/readiness.service.ts"
import RegistryGenerations from "./application/registry_generations.service.ts"
import RegistrySnapshots from "./application/registry_snapshots.service.ts"
import RemoteSponsorStatus from "./application/remote_sponsor_status.service.ts"
import { presentationStatusMaxAgeSeconds } from "./domain/presentation_status_age.ts"
import { registrySnapshotMaxAgeSeconds } from "./domain/registry_snapshot_age.ts"
import { readServiceConfig } from "./infrastructure/config/read_service_config.ts"
import GrpcDeliveryFeed from "./infrastructure/grpc/grpc_delivery_feed.adapter.ts"
import GrpcReviewFeed from "./infrastructure/grpc/grpc_review_feed.adapter.ts"
import BundleAssets from "./infrastructure/http/bundle_assets.ts"
import { registerCredentialRoutes } from "./infrastructure/http/credential_routes.ts"
import { registerHolderRoutes } from "./infrastructure/http/holder_routes.ts"
import { buildHttpServer } from "./infrastructure/http/http_server.ts"
import { registerPredicateRoutes } from "./infrastructure/http/predicate_routes.ts"
import { registerPresentationRoutes } from "./infrastructure/http/presentation_routes.ts"
import { registerRegistrySnapshotRoutes } from "./infrastructure/http/registry_snapshot_routes.ts"
import { registerVerifierRoutes } from "./infrastructure/http/verifier_routes.ts"
import JoseTokenVerifier from "./infrastructure/identity/jose_token_verifier.adapter.ts"
import { loadMeshIdentity } from "./infrastructure/mesh/mesh_identity.ts"
import { withProjectId } from "./infrastructure/midnight/blockfrost_url.ts"
import { contractBuildDigest } from "./infrastructure/midnight/contract_build_digest.ts"
import { credentialRegistryDirectory } from "./infrastructure/midnight/credential_registry_contract.ts"
import IndexerBlocks from "./infrastructure/midnight/indexer_blocks.ts"
import LedgerPresentationInspector from "./infrastructure/midnight/ledger_presentation_inspector.ts"
import MidnightCredentialChain from "./infrastructure/midnight/midnight_credential_chain.adapter.ts"
import MidnightRegistryChain from "./infrastructure/midnight/midnight_registry_chain.adapter.ts"
import { serviceSecrets } from "./infrastructure/midnight/seal_secrets.ts"
import { estateMetrics } from "./infrastructure/observability/estate_metrics.ts"
import JsonLogger from "./infrastructure/observability/json_logger.ts"
import PrometheusCredentialMetrics from "./infrastructure/observability/prometheus_credential_metrics.adapter.ts"
import PrometheusFeedMetrics from "./infrastructure/observability/prometheus_feed_metrics.adapter.ts"
import PrometheusPredicateMetrics from "./infrastructure/observability/prometheus_predicate_metrics.adapter.ts"
import PrometheusPresentationMetrics from "./infrastructure/observability/prometheus_presentation_metrics.adapter.ts"
import PrometheusRegistryGauges from "./infrastructure/observability/prometheus_registry_gauges.adapter.ts"
import { redactOutput } from "./infrastructure/observability/redacting_output.ts"
import { createPrismaClient } from "./infrastructure/postgres/prisma_client.ts"
import PrismaCourierFactStore from "./infrastructure/postgres/prisma_courier_fact_store.adapter.ts"
import PrismaCredentialStore from "./infrastructure/postgres/prisma_credential_store.adapter.ts"
import PrismaDatabaseProbe from "./infrastructure/postgres/prisma_database_probe.adapter.ts"
import PrismaPredicatePlacementStore from "./infrastructure/postgres/prisma_predicate_placement_store.adapter.ts"
import PrismaPredicateTemplateStore from "./infrastructure/postgres/prisma_predicate_template_store.adapter.ts"
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
const midnightConfig = { networkId: config.midnight.networkId, ttlSeconds: 3600 }
const zkConfig = new NodeZkConfigProvider<string>(credentialRegistryDirectory)
const publicData = indexerPublicDataProvider({
  queryURL: withProjectId(config.midnight.indexerHttpUrl, config.blockfrostProjectId),
  subscriptionURL: withProjectId(config.midnight.indexerWsUrl, config.blockfrostProjectId)
})

const proofs = httpClientProofProvider({ url: config.midnight.proofServerUrl, zkConfigProvider: zkConfig })
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
    config: midnightConfig,
    networkStepSeconds: config.midnightStepSeconds
  }),
  generationStore,
  registryGauges,
  logger,
  config.midnight.networkId,
  await contractBuildDigest(credentialRegistryDirectory)
)

const registryChain = new MidnightCredentialChain({
  payer: sponsor,
  publicData,
  proofs,
  zkConfig,
  issuerSecret: config.issuerSecret,
  config: midnightConfig,
  networkStepSeconds: config.midnightStepSeconds
})

const credentialIssuer = new CredentialIssuer(
  registryChain,
  credentialStore,
  generationStore,
  credentialMetrics,
  logger,
  now
)

const predicateTemplates = new PrismaPredicateTemplateStore(prisma)
const predicatePlacements = new PrismaPredicatePlacementStore(prisma)
const predicateKeeper = new PredicateKeeper({
  chain: registryChain,
  templates: predicateTemplates,
  placements: predicatePlacements,
  generations: generationStore,
  metrics: new PrometheusPredicateMetrics(registry),
  logger,
  clock: now,
  periodDays: config.predicates.periodDays
})

const tokens = new JoseTokenVerifier(config.identity)
const server = buildHttpServer({ service, readiness, registry, metrics, logger })

registerCredentialRoutes(server, {
  credentials: new CourierCredentials(
    courierFactStore,
    credentialStore,
    generationStore,
    credentialMetrics,
    config.credentials.factsMaxAgeSeconds
  ),
  tokens,
  logger,
  metrics,
  clock: now
})

registerPredicateRoutes(server, {
  predicates: new PredicateCatalogue({
    chain: registryChain,
    templates: predicateTemplates,
    placements: predicatePlacements,
    generations: generationStore,
    logger,
    periodDays: config.predicates.periodDays
  }),
  tokens,
  logger,
  metrics,
  clock: now
})

registerRegistrySnapshotRoutes(server, {
  snapshots: new RegistrySnapshots(registryChain, generationStore, registrySnapshotMaxAgeSeconds, now),
  logger,
  metrics
})

registerPresentationRoutes(server, {
  relay: new PresentationRelay({
    inspector: new LedgerPresentationInspector(),
    payer: sponsor,
    generations: generationStore,
    metrics: new PrometheusPresentationMetrics(registry)
  }),
  statuses: new PresentationStatuses(registryChain, generationStore, presentationStatusMaxAgeSeconds, now),
  logger,
  metrics
})

registerVerifierRoutes(server, {
  assets: BundleAssets.load(fileURLToPath(new URL("../verifier-bundle/", import.meta.url)), [
    "verifier.js",
    "verifier.css"
  ]),
  metrics
})

registerHolderRoutes(server, {
  assets: BundleAssets.load(fileURLToPath(new URL("../holder-bundle/", import.meta.url)), ["index.html", "holder.js"]),
  metrics
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

stops.push(
  repeat(config.predicates.reconcileSeconds, async () => {
    const condition = sponsorStatus.condition()

    if (condition === "syncing" || condition === "unreachable") {
      return
    }

    await predicateKeeper.reconcile().catch((error: unknown) => {
      logger.error({ message: "the registry's predicates could not be reconciled" }, error)
    })
  })
)
